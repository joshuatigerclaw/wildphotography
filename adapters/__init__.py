#!/usr/bin/env python3
"""
Adapter wrapper that loads production adapters when credentials are available,
falls back to stub adapters otherwise.
"""

import os
import logging

logger = logging.getLogger(__name__)

# Try to import production adapter
PRODUCTION_ADAPTER_AVAILABLE = False

try:
    from adapters.production_adapter import create_production_adapter, ProductionBackendAdapter
    PRODUCTION_ADAPTER_AVAILABLE = True
except ImportError as e:
    logger.warning(f"Production adapter not available: {e}")


def create_backend_adapter(dry_run: bool = False):
    """
    Create the appropriate backend adapter.
    
    Uses production adapter if all required credentials are available,
    otherwise falls back to stub adapter.
    """
    # Check if we have enough credentials for production
    has_r2 = all([
        os.environ.get('R2_ENDPOINT'),
        os.environ.get('R2_ACCESS_KEY_ID'),
        os.environ.get('R2_SECRET_ACCESS_KEY'),
        os.environ.get('R2_BUCKET')
    ])
    
    has_neon = bool(os.environ.get('NEON_CONNECTION_STRING'))
    
    if has_r2 and has_neon and PRODUCTION_ADAPTER_AVAILABLE:
        logger.info("Using PRODUCTION backend adapter")
        return create_production_adapter(
            r2_endpoint=os.environ.get('R2_ENDPOINT'),
            r2_access_key=os.environ.get('R2_ACCESS_KEY_ID'),
            r2_secret_key=os.environ.get('R2_SECRET_ACCESS_KEY'),
            r2_bucket=os.environ.get('R2_BUCKET'),
            r2_public=os.environ.get('R2_PUBLIC_URL'),
            neon_conn=os.environ.get('NEON_CONNECTION_STRING'),
            typesense_host=os.environ.get('TYPESENSE_HOST'),
            typesense_port=int(os.environ.get('TYPESENSE_PORT', '443')),
            typesense_key=os.environ.get('TYPESENSE_API_KEY'),
            dry_run=dry_run
        )
    else:
        logger.info("Using STUB backend adapter (no credentials)")
        # Import and return stub adapter
        from wildphotography_master_controller import BackendAdapter
        return BackendAdapter(dry_run=dry_run)


__all__ = ['create_backend_adapter']
