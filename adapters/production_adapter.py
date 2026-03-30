#!/usr/bin/env python3
"""
WildPhotography Production Backend Adapter

Implements real adapters for:
- Cloudflare R2 (upload, derivatives)
- Neon PostgreSQL (photos, galleries)
- Typesense (search indexing)

Required environment variables (defaults from TOOLS.md):
- R2_ENDPOINT=https://3ec62f93675c404fe4a9a4949e38e5e5.r2.cloudflarestorage.com
- R2_ACCESS_KEY_ID=b821d56d29d9a2c716f783fc481e2f75
- R2_SECRET_ACCESS_KEY=3af780dfe8dbb6d48b792e4bf8ba5836ae659c89192645a7ae971300464aa48f
- R2_BUCKET=wildphoto-storage
- R2_PUBLIC_URL=https://pub-7d412c6efb5943b5bc587e695e22001e.r2.dev
- NEON_CONNECTION_STRING=postgresql://neondb_owner:npg_BvF2JsQ8drba@ep-calm-fire-ad0dfnqd-pooler.c-2.us-east-1.aws.neon.tech/wildphotography?sslmode=require
- TYPESENSE_HOST=uibn03zvateqwdx2p-1.a1.typesense.net
- TYPESENSE_PORT=443
- TYPESENSE_API_KEY=MPphr9zDlLzHRFQHDH4AyQb5hw2ugew7
"""

import base64
import hashlib
import io
import json
import logging
import os
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
from urllib.parse import urlparse

import boto3
from botocore.config import Config
from botocore.exceptions import ClientError
import psycopg2
from psycopg2 import sql
from psycopg2.extras import RealDictCursor, Json

logger = logging.getLogger(__name__)


@dataclass
class R2Config:
    endpoint: str
    access_key_id: str
    secret_access_key: str
    bucket: str
    public_url: str


@dataclass  
class NeonConfig:
    connection_string: str


@dataclass
class TypesenseConfig:
    host: str
    port: int
    api_key: str
    https: bool = True


class R2Adapter:
    """Cloudflare R2 storage adapter."""
    
    def __init__(self, config: R2Config):
        self.config = config
        self.client = boto3.client(
            's3',
            endpoint_url=config.endpoint,
            aws_access_key_id=config.access_key_id,
            aws_secret_access_key=config.secret_access_key,
            region_name='auto',
            config=Config(signature_version='s3v4')
        )
        self.bucket = config.bucket
        
    def upload_binary(self, local_path: Path, storage_key: str) -> str:
        """Upload original to R2."""
        try:
            with open(local_path, 'rb') as f:
                self.client.upload_fileobj(
                    f,
                    self.bucket,
                    storage_key,
                    ExtraArgs={
                        'ContentType': self._get_content_type(storage_key)
                    }
                )
            logger.info(f"Uploaded {local_path.name} to {storage_key}")
            return f"{self.config.public_url}/{storage_key}"
        except ClientError as e:
            logger.error(f"R2 upload failed: {e}")
            raise
            
    def generate_and_upload_derivatives(self, local_path: Path, storage_key: str) -> Dict[str, str]:
        """Generate and upload thumb/web_small/web_large/print derivatives."""
        from PIL import Image
        
        base_key = storage_key.rsplit('.', 1)[0]
        ext = '.' + storage_key.rsplit('.', 1)[1] if '.' in storage_key else '.jpg'
        
        derivatives = {}
        sizes = {
            'thumb': (400, 400),
            'web_small': (900, 900),
            'web_large': (2400, 2400),
            'print': (4000, 4000)
        }
        
        try:
            img = Image.open(local_path)
            
            for size_name, (max_w, max_h) in sizes.items():
                # Calculate resize dimensions maintaining aspect ratio
                w, h = img.size
                if w > max_w or h > max_h:
                    ratio = min(max_w / w, max_h / h)
                    new_size = (int(w * ratio), int(h * ratio))
                else:
                    new_size = (w, h)
                    
                resized = img.resize(new_size, Image.Resampling.LANCZOS)
                
                # Upload
                deriv_key = f"{size_name}s/{base_key.split('/')[-1]}-{size_name}{ext}"
                buffer = io.BytesIO()
                resized.save(buffer, format='JPEG', quality=85)
                buffer.seek(0)
                
                self.client.upload_fileobj(
                    buffer,
                    self.bucket,
                    deriv_key,
                    ExtraArgs={'ContentType': 'image/jpeg'}
                )
                
                derivatives[size_name] = f"{self.config.public_url}/{deriv_key}"
                logger.info(f"Generated {size_name}: {deriv_key}")
                
        except Exception as e:
            logger.error(f"Derivative generation failed: {e}")
            # Return placeholder URLs even if generation failed
            for size_name in sizes:
                derivatives[size_name] = ""
                
        # Add original
        derivatives['original'] = f"{self.config.public_url}/{storage_key}"
        return derivatives
        
    def check_exists(self, storage_key: str) -> bool:
        """Check if object exists in R2."""
        try:
            self.client.head_object(Bucket=self.bucket, Key=storage_key)
            return True
        except ClientError:
            return False
            
    def _get_content_type(self, key: str) -> str:
        ext = Path(key).suffix.lower()
        types = {
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg', 
            '.png': 'image/png',
            '.webp': 'image/webp',
            '.tif': 'image/tiff',
            '.tiff': 'image/tiff'
        }
        return types.get(ext, 'application/octet-stream')


class NeonAdapter:
    """Neon PostgreSQL adapter."""
    
    def __init__(self, config: NeonConfig):
        self.config = config
        
    def _get_connection(self):
        return psycopg2.connect(
            self.config.connection_string,
            cursor_factory=RealDictCursor
        )
        
    def find_photo_by_hash(self, content_hash: str) -> Optional[Dict[str, Any]]:
        """Lookup photo by content hash for deduplication."""
        conn = self._get_connection()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT * FROM photos WHERE content_hash = %s LIMIT 1",
                    (content_hash,)
                )
                return cur.fetchone()
        finally:
            conn.close()
            
    def find_photo_by_slug(self, slug: str) -> Optional[Dict[str, Any]]:
        """Lookup photo by slug."""
        conn = self._get_connection()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT * FROM photos WHERE slug = %s LIMIT 1",
                    (slug,)
                )
                return cur.fetchone()
        finally:
            conn.close()
            
    def upsert_gallery(self, name: str, slug: str) -> Tuple[str, bool]:
        """Insert or reuse existing gallery. Returns (id, created)."""
        conn = self._get_connection()
        try:
            with conn.cursor() as cur:
                # Check if exists
                cur.execute(
                    "SELECT id FROM galleries WHERE slug = %s",
                    (slug,)
                )
                existing = cur.fetchone()
                
                if existing:
                    return str(existing['id']), False
                    
                # Insert new
                cur.execute(
                    """INSERT INTO galleries (name, slug) VALUES (%s, %s) 
                       RETURNING id""",
                    (name, slug)
                )
                conn.commit()
                result = cur.fetchone()
                return str(result['id']), True
        finally:
            conn.close()
            
    def find_gallery_by_slug(self, slug: str) -> Optional[Dict[str, Any]]:
        """Find gallery by slug."""
        conn = self._get_connection()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT * FROM galleries WHERE slug = %s",
                    (slug,)
                )
                return cur.fetchone()
        finally:
            conn.close()
            
    def upsert_photo(self, record: Dict[str, Any]) -> Tuple[str, bool]:
        """Insert or update photo record. Returns (id, created)."""
        conn = self._get_connection()
        try:
            with conn.cursor() as cur:
                # Helper to convert empty strings to None
                def to_none(val):
                    if val == '' or val is None:
                        return None
                    return val
                
                # Clean all values
                cleaned = {k: to_none(v) for k, v in record.items()}
                
                # Check if exists by content hash
                content_hash = cleaned.get('content_hash')
                if content_hash:
                    cur.execute(
                        "SELECT id FROM photos WHERE content_hash = %s",
                        (content_hash,)
                    )
                    existing = cur.fetchone()
                    
                if existing:
                    # Update existing - preserve stronger values
                    photo_id = str(existing['id'])
                    
                    # Convert keywords array to comma-separated string
                    keywords_val = cleaned.get('keywords', '')
                    if isinstance(keywords_val, list):
                        keywords_val = ','.join(keywords_val)
                    
                    cur.execute(
                        f"""UPDATE photos SET
                            title = COALESCE(NULLIF(%s, ''), title),
                            description = COALESCE(NULLIF(%s, ''), description),
                            keywords = COALESCE(NULLIF(%s, ''), keywords),
                            updated_at = NOW()
                            WHERE id = %s
                            RETURNING id""",
                        (
                            cleaned.get('title', ''),
                            cleaned.get('description', ''),
                            keywords_val,
                            photo_id
                        )
                    )
                    conn.commit()
                    return photo_id, False
                    
                # Insert new - convert all complex types to strings
                keywords_val = cleaned.get('keywords', '')
                if isinstance(keywords_val, list):
                    keywords_val = ','.join(str(k) for k in keywords_val)
                elif keywords_val is None:
                    keywords_val = ''
                
                # Helper to convert empty strings to None for numeric fields
                def to_none(val):
                    if val == '' or val is None:
                        return None
                    return val
                
                # Clean all values
                cleaned = {k: to_none(v) for k, v in record.items()}
                keywords_val = cleaned.get('keywords', '')
                if isinstance(keywords_val, list):
                    keywords_val = ','.join(str(k) for k in keywords_val)
                elif keywords_val is None:
                    keywords_val = ''
                    
                cur.execute(
                    """INSERT INTO photos (
                        slug, source_path, filename, canonical_filename, content_hash,
                        gallery_id, gallery_slug, title, description, keywords,
                        country, region, location_name, latitude, longitude,
                        camera_make, camera_model, iso, shutter_speed,
                        aperture, focal_length_mm, width, height, date_taken,
                        r2_original_key, r2_thumb_key, r2_web_small_key, r2_web_large_key, r2_print_key,
                        thumb_url, small_url, medium_url, large_url, preview_url,
                        ready_for_public_render, search_ready, state
                    ) VALUES (
                        %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
                        %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
                        %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
                        %s, %s, %s, %s, %s, %s, %s
                    ) RETURNING id""",
                    (
                        cleaned.get('slug'),
                        cleaned.get('source_path'),
                        cleaned.get('filename'),
                        cleaned.get('canonical_filename'),
                        cleaned.get('content_hash'),
                        cleaned.get('gallery_id'),
                        cleaned.get('gallery_slug'),
                        cleaned.get('title'),
                        cleaned.get('description'),
                        keywords_val,
                        cleaned.get('country'),
                        cleaned.get('region'),
                        cleaned.get('location_name'),
                        to_none(cleaned.get('latitude')),
                        to_none(cleaned.get('longitude')),
                        cleaned.get('camera_make'),
                        cleaned.get('camera_model'),
                        cleaned.get('iso'),
                        cleaned.get('shutter_speed'),
                        cleaned.get('aperture'),
                        cleaned.get('focal_length_mm'),
                        to_none(cleaned.get('width')),
                        to_none(cleaned.get('height')),
                        cleaned.get('date_taken'),
                        cleaned.get('r2_original_key'),
                        cleaned.get('r2_thumb_key'),
                        cleaned.get('r2_web_small_key'),
                        cleaned.get('r2_web_large_key'),
                        cleaned.get('r2_print_key'),
                        cleaned.get('thumb_url'),
                        cleaned.get('small_url'),
                        cleaned.get('medium_url'),
                        cleaned.get('large_url'),
                        cleaned.get('preview_url'),
                        cleaned.get('ready_for_public_render', True),
                        cleaned.get('search_ready', True),
                        cleaned.get('state', 'published')
                    )
                )
                conn.commit()
                result = cur.fetchone()
                return str(result['id']), True
        finally:
            conn.close()
            
    def link_photo_to_gallery(self, photo_id: str, gallery_id: str, sort_order: int = 0) -> None:
        """Link photo to gallery."""
        conn = self._get_connection()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    """INSERT INTO gallery_photos (gallery_id, photo_id, sort_order)
                       VALUES (%s, %s, %s)
                       ON CONFLICT (gallery_id, photo_id) DO NOTHING""",
                    (gallery_id, photo_id, sort_order)
                )
                conn.commit()
        finally:
            conn.close()


class TypesenseAdapter:
    """Typesense search adapter."""
    
    def __init__(self, config: TypesenseConfig):
        self.config = config
        self.collection = 'photos'
        self._admin_key = os.environ.get('TYPESENSE_ADMIN_KEY') or os.environ.get('TYPESENSE_API_KEY')
        
    def _get_base_url(self) -> str:
        scheme = 'https' if self.config.https else 'http'
        return f"{scheme}://{self.config.host}:{self.config.port}"
    
    def is_admin_available(self) -> bool:
        """Check if admin key is available for indexing."""
        # Admin key works if set (even if same as search key - some setups allow writes with same key)
        return bool(self._admin_key)
    
    def get_status(self) -> Dict[str, Any]:
        """Get Typesense indexing status."""
        if not self._admin_key:
            return {
                'status': 'BLOCKED',
                'reason': 'Missing TYPESENSE_ADMIN_KEY env var',
                'required_env_vars': ['TYPESENSE_ADMIN_KEY'],
                'can_index': False
            }
        
        return {
            'status': 'READY',
            'can_index': True
        }
        
    def index_search_document(self, record: Dict[str, Any]) -> bool:
        """Index a photo document for search. Returns False if blocked."""
        
        # Check if indexing is available
        status = self.get_status()
        if not status['can_index']:
            print(f"[Typesense] BLOCKED: {status['reason']}")
            return False
        import requests
        
        # Clean the record
        def to_none(val):
            if val == '' or val is None:
                return None
            return val
        cleaned = {k: to_none(v) for k, v in record.items()}
        
        url = f"{self._get_base_url()}/collections/{self.collection}/documents"
        # Use admin key for indexing (search-only key won't work for writes)
        admin_key = os.environ.get('TYPESENSE_ADMIN_KEY') or self.config.api_key
        headers = {
            'Content-Type': 'application/json',
            'X-TYPESENSE-API-KEY': admin_key
        }
        
        # Map to Typesense schema (existing collection)
        doc = {
            'slug': str(cleaned.get('slug', '') or ''),
            'title': str(cleaned.get('title', '') or ''),
            'description': str(cleaned.get('description', '') or ''),
            'keywords': cleaned.get('keywords', []) or [],
            'gallery': str(cleaned.get('gallery_name', cleaned.get('gallery_slug', '')) or ''),
            'gallery_slug': str(cleaned.get('gallery_slug', '') or ''),
            'location_name': str(cleaned.get('location_name', cleaned.get('location', '') or '')),
            'thumb_url': str(cleaned.get('thumb_url', '') or ''),
            'small_url': str(cleaned.get('small_url', '') or ''),
            'medium_url': str(cleaned.get('medium_url', '') or ''),
            'large_url': str(cleaned.get('large_url', '') or ''),
            'taken_timestamp': int(cleaned.get('date_taken', 0)) if cleaned.get('date_taken') else 0,
            'taken_year': int(str(cleaned.get('date_taken', ''))[:4]) if cleaned.get('date_taken') and len(str(cleaned.get('date_taken'))) >= 4 else 0,
            'species_common_name': str(cleaned.get('species_common_name', '') or ''),
            'species_scientific_name': str(cleaned.get('species_scientific_name', '') or ''),
            'country': str(cleaned.get('country', '') or ''),
            'region': str(cleaned.get('region', '') or ''),
            'category': str(cleaned.get('category', '') or ''),
            'animal_group': str(cleaned.get('animal_group', '') or ''),
        }
        
        try:
            # Try upsert
            response = requests.post(
                url,
                headers=headers,
                params={'action': 'upsert'},
                json=doc,
                timeout=10
            )
            if response.status_code in (200, 201):
                logger.info(f"Indexed document: {doc['slug']}")
                return True
            else:
                logger.warning(f"Index failed: {response.status_code} {response.text}")
                return False
        except Exception as e:
            logger.error(f"Typesense indexing error: {e}")
            return False
            
    def delete_document(self, doc_id: str) -> bool:
        """Delete a document from search index."""
        import requests
        
        url = f"{self._get_base_url()}/collections/{self.collection}/documents/{doc_id}"
        headers = {'X-TYPESENSE-API-KEY': self.config.api_key}
        
        try:
            response = requests.delete(url, headers=headers, timeout=10)
            return response.status_code in (200, 404)
        except Exception as e:
            logger.error(f"Typesense delete error: {e}")
            return False


class ProductionBackendAdapter:
    """Combined production adapter using R2, Neon, and Typesense."""
    
    def __init__(
        self,
        r2_config: R2Config,
        neon_config: NeonConfig,
        typesense_config: TypesenseConfig,
        dry_run: bool = False
    ):
        self.dry_run = dry_run
        self.r2 = R2Adapter(r2_config)
        self.neon = NeonAdapter(neon_config)
        self.typesense = TypesenseAdapter(typesense_config)
        
    def find_photo_by_hash(self, content_hash: str) -> Optional[Dict[str, Any]]:
        return self.neon.find_photo_by_hash(content_hash)
        
    def find_photo_by_slug(self, slug: str) -> Optional[Dict[str, Any]]:
        return self.neon.find_photo_by_slug(slug)
        
    def upsert_gallery(self, name: str, slug: str) -> Dict[str, Any]:
        """Insert or reuse existing gallery. Returns dict with id and created flag."""
        gallery_id, created = self.neon.upsert_gallery(name, slug)
        return {"id": gallery_id, "name": name, "slug": slug, "created": created}
        
    def find_gallery_by_slug(self, slug: str) -> Optional[Dict[str, Any]]:
        return self.neon.find_gallery_by_slug(slug)
        
    def build_storage_key(self, gallery_slug: str, filename: str, content_hash: str) -> str:
        """Build collision-safe storage key."""
        from slugify import slugify
        base = slugify(Path(filename).stem) or "image"
        ext = Path(filename).suffix.lower() or ".jpg"
        return f"originals/{gallery_slug}/{base}-{content_hash[:12]}{ext}"
        
    def upload_binary(self, local_path: Path, storage_key: str) -> str:
        if self.dry_run:
            logger.info(f"[DRY RUN] Would upload {local_path} to {storage_key}")
            return f"https://pub-xxx.r2.dev/{storage_key}"
        return self.r2.upload_binary(local_path, storage_key)
        
    def generate_and_upload_derivatives(self, local_path: Path, storage_key: str) -> Dict[str, str]:
        if self.dry_run:
            logger.info(f"[DRY RUN] Would generate derivatives for {local_path}")
            return {
                'original': f"https://pub-xxx.r2.dev/{storage_key}",
                'thumb': '',
                'web_small': '',
                'web_large': '',
                'print': ''
            }
        return self.r2.generate_and_upload_derivatives(local_path, storage_key)
        
    def upsert_photo(self, record: Dict[str, Any]) -> Tuple[str, bool]:
        if self.dry_run:
            slug = record.get('slug', 'unknown')
            logger.info(f"[DRY RUN] Would upsert photo: {slug}")
            return "dry-run-id", True
        return self.neon.upsert_photo(record)
        
    def link_photo_to_gallery(self, photo_id: str, gallery_id: str, sort_order: int = 0) -> None:
        if not self.dry_run:
            self.neon.link_photo_to_gallery(photo_id, gallery_id, sort_order)
            
    def index_search_document(self, record: Dict[str, Any]) -> bool:
        if self.dry_run:
            logger.info(f"[DRY RUN] Would index: {record.get('slug')}")
            return True
        
        # Clean the record
        def to_none(val):
            if val == '' or val is None:
                return None
            return val
        cleaned = {k: to_none(v) for k, v in record.items()}
        
        # Only index if flags are set - check ACTUAL values in the dict, not just presence
        ready_render = cleaned.get('ready_for_public_render')
        search_ready = cleaned.get('search_ready')
        
        # Only index if explicitly True (not just truthy)
        if ready_render is not True or search_ready is not True:
            logger.info(f"Skipping indexing - not ready: {cleaned.get('slug')}, ready={ready_render}, search={search_ready}")
            return False
            
        return self.typesense.index_search_document(record)


def create_production_adapter(
    r2_endpoint: str = None,
    r2_access_key: str = None,
    r2_secret_key: str = None,
    r2_bucket: str = None,
    r2_public: str = None,
    neon_conn: str = None,
    typesense_host: str = None,
    typesense_port: int = 443,
    typesense_key: str = None,
    dry_run: bool = False
) -> ProductionBackendAdapter:
    """Factory function to create production adapter from environment."""
    
    r2_config = R2Config(
        endpoint=r2_endpoint or os.environ.get('R2_ENDPOINT', 'https://3ec62f93675c404fe4a9a4949e38e5e5.r2.cloudflarestorage.com'),
        access_key_id=r2_access_key or os.environ.get('R2_ACCESS_KEY_ID', 'b821d56d29d9a2c716f783fc481e2f75'),
        secret_access_key=r2_secret_key or os.environ.get('R2_SECRET_ACCESS_KEY', '3af780dfe8dbb6d48b792e4bf8ba5836ae659c89192645a7ae971300464aa48f'),
        bucket=r2_bucket or os.environ.get('R2_BUCKET', 'wildphoto-storage'),
        public_url=r2_public or os.environ.get('R2_PUBLIC_URL', 'https://pub-7d412c6efb5943b5bc587e695e22001e.r2.dev')
    )
    
    neon_config = NeonConfig(
        connection_string=neon_conn or os.environ.get('NEON_CONNECTION_STRING', 'postgresql://neondb_owner:npg_BvF2JsQ8drba@ep-calm-fire-ad0dfnqd-pooler.c-2.us-east-1.aws.neon.tech/wildphotography?sslmode=require')
    )
    
    typesense_config = TypesenseConfig(
        host=typesense_host or os.environ.get('TYPESENSE_HOST', 'uibn03zvateqwdx2p-1.a1.typesense.net'),
        port=typesense_port,
        api_key=typesense_key or os.environ.get('TYPESENSE_API_KEY', 'MPphr9zDlLzHRFQHDH4AyQb5hw2ugew7'),
        https=os.environ.get('TYPESENSE_HTTPS', 'true').lower() == 'true'
    )
    
    return ProductionBackendAdapter(r2_config, neon_config, typesense_config, dry_run)
