// ULTRA MINIMAL - no DB calls, no complex components
// If this 500s, the issue is NOT in our code but in the infrastructure
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  return { title: `Location: ${(await params).slug}` };
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  
  return (
    <div className="container mx-auto px-4 py-6">
      <h1 className="text-4xl font-bold">Location: {slug}</h1>
      <p className="mt-4">Ultra minimal test page.</p>
      <Link href="/" className="text-blue-600 mt-4 inline-block">← Home</Link>
      <div className="mt-8 p-4 bg-gray-100 rounded">
        <p>If you see this, the location page route is working.</p>
        <p>Slug: {slug}</p>
      </div>
    </div>
  );
}