import { notFound } from "next/navigation";
import { Metadata } from "next";
import { getPhotoBySlug, getGalleryForPhoto } from "@/lib/db";
import BuyPageClient from "./BuyPageClient";

const R2_PUBLIC = "https://images.wildphotography.com";
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://wildphotography.com";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const photo = await getPhotoBySlug(slug);

  if (!photo) {
    return { title: "Photo Not Found" };
  }

  return {
    title: `Purchase ${photo.title || slug} | Wildphotography`,
    description: `Buy high-resolution or web-resolution license for ${photo.title || slug}. Secure PayPal payment.`,
    robots: { index: false, follow: false },
  };
}

function withR2(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith("http")) return url;
  return R2_PUBLIC + "/" + url;
}

export default async function BuyPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const photo = await getPhotoBySlug(slug);

  if (!photo) {
    notFound();
  }

  const gallery = await getGalleryForPhoto(slug);

  const clientPhoto = {
    id: String(photo.id),
    slug: photo.slug,
    title: photo.title,
    thumbUrl: withR2(photo.thumbUrl),
    gallery_slug: gallery?.slug || "",
    gallery_title: gallery?.name || "",
  };

  return <BuyPageClient photo={clientPhoto} />;
}
