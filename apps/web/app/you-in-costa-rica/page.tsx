'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

const CATEGORIES = ['Beach', 'Volcano', 'Waterfall', 'Rainforest', 'Wildlife', 'Aerial', 'Sunset'] as const;
type Category = typeof CATEGORIES[number];

interface BackgroundPhoto {
  id: string;
  slug: string;
  title: string;
  mediumUrl: string;
  gallerySlug: string;
  r2Key: string;
  cdnUrl: string;
}

interface UploadResponse {
  uploadUrl: string;
  key: string;
}

interface CreateJobResponse {
  jobId: string;
}

interface JobStatus {
  id: string;
  status: string;
  freeOutputCdnUrl?: string;
  premiumOutputCdnUrl?: string;
  checkoutUrl?: string;
  errorMessage?: string;
}

export default function YouInCostaRicaPage() {
  const [activeCategory, setActiveCategory] = useState<Category>('Beach');
  const [backgrounds, setBackgrounds] = useState<BackgroundPhoto[]>([]);
  const [selectedBackground, setSelectedBackground] = useState<BackgroundPhoto | null>(null);
  const [loadingBackgrounds, setLoadingBackgrounds] = useState(false);

  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string>('');
  const [agreed, setAgreed] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadStage, setUploadStage] = useState<string>('');

  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<JobStatus | null>(null);

  const sessionId = useRef(crypto.randomUUID()).current;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchBackgrounds = useCallback(async (category: Category) => {
    setLoadingBackgrounds(true);
    try {
      const res = await fetch(`/api/you-in-costa-rica/backgrounds?category=${category}`);
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setBackgrounds(data.photos || []);
    } catch {
      setBackgrounds([]);
    } finally {
      setLoadingBackgrounds(false);
    }
  }, []);

  useEffect(() => {
    fetchBackgrounds(activeCategory);
  }, [activeCategory, fetchBackgrounds]);

  const handleBackgroundSelect = (bg: BackgroundPhoto) => {
    setSelectedBackground(bg);
    setFile(null);
    setFileError('');
    setAgreed(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFileError('');
    const f = e.target.files?.[0];
    if (!f) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(f.type)) {
      setFileError('Please select a JPEG, PNG, or WebP image.');
      return;
    }
    if (f.size > 10 * 1024 * 1024) {
      setFileError('Image must be under 10MB.');
      return;
    }
    setFile(f);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f) {
      const fakeEvent = { target: { files: [f] } } as unknown as React.ChangeEvent<HTMLInputElement>;
      handleFileChange(fakeEvent);
    }
  }, []);

  const handleUpload = async () => {
    if (!file || !agreed || !selectedBackground) return;

    setUploading(true);
    setUploadStage('Generating upload URL...');

    try {
      // Step 1: Get presigned URL
      const urlRes = await fetch('/api/you-in-costa-rica/upload-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mime: file.type, size: file.size, sessionId }),
      });
      if (!urlRes.ok) throw new Error('Failed to get upload URL');
      const { uploadUrl, key: uploadedUserR2Key }: UploadResponse = await urlRes.json();

      // Step 2: Upload file directly to R2 via presigned URL
      setUploadStage('Uploading your photo...');
      const putRes = await fetch(uploadUrl, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type },
      });
      if (!putRes.ok) throw new Error('Failed to upload file');

      // Step 3: Create job
      setUploadStage('Creating your Costa Rica photo...');
      const createRes = await fetch('/api/you-in-costa-rica/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourcePhotoId: selectedBackground.id,
          sourcePhotoSlug: selectedBackground.slug,
          sourceGallerySlug: selectedBackground.gallerySlug,
          sourceR2Key: selectedBackground.r2Key,
          sourceCdnUrl: selectedBackground.cdnUrl,
          uploadedUserR2Key,
          uploadedUserMime: file.type,
          uploadedUserSize: file.size,
          sessionId,
        }),
      });
      if (!createRes.ok) throw new Error('Failed to create job');
      const { jobId }: CreateJobResponse = await createRes.json();

      setCurrentJobId(jobId);
    } catch (err) {
      setFileError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
      setUploading(false);
    }
  };

  // Poll job status
  useEffect(() => {
    if (!currentJobId) return;

    const poll = async () => {
      try {
        const res = await fetch(`/api/you-in-costa-rica/job/${currentJobId}`);
        if (!res.ok) return;
        const data: JobStatus = await res.json();
        setJobStatus(data);

        const terminal = ['free_ready', 'premium_ready', 'failed', 'payment_pending'];
        if (terminal.includes(data.status)) {
          setUploading(false);
        }
      } catch {
        // ignore poll errors
      }
    };

    poll();
    const interval = setInterval(poll, 2000);
    return () => clearInterval(interval);
  }, [currentJobId]);

  const reset = () => {
    setSelectedBackground(null);
    setCurrentJobId(null);
    setJobStatus(null);
    setFile(null);
    setFileError('');
    setAgreed(false);
    setUploading(false);
  };

  const handleBundleCheckout = async () => {
    if (!currentJobId) return;
    try {
      const res = await fetch('/api/you-in-costa-rica/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId: currentJobId, bundle: true }),
      });
      const data = await res.json();
      if (data.checkoutUrl) {
        window.open(data.checkoutUrl, '_blank');
      }
    } catch {
      // silently fail
    }
  };

  const scrollToSection2 = () => {
    document.getElementById('background-selector')?.scrollIntoView({ behavior: 'smooth' });
  };

  const renderResult = () => {
    if (!jobStatus) return null;
    const { status, freeOutputCdnUrl, premiumOutputCdnUrl, checkoutUrl, errorMessage } = jobStatus;

    if (status === 'uploaded' || status === 'processing') {
      return (
        <div className="flex flex-col items-center justify-center py-24">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-6" />
          <p className="text-gray-300 text-xl font-medium">Creating your Costa Rica photo…</p>
          <p className="text-gray-500 text-sm mt-2">This usually takes 10–30 seconds</p>
        </div>
      );
    }

    if (status === 'failed') {
      return (
        <div className="flex flex-col items-center py-16 text-center">
          <p className="text-red-400 text-lg mb-4">{errorMessage || 'Generation failed. Please try again.'}</p>
          <button
            onClick={reset}
            className="px-6 py-3 bg-gray-800 hover:bg-gray-700 text-white rounded-lg font-medium transition-colors"
          >
            Try Again
          </button>
        </div>
      );
    }

    if (status === 'free_ready') {
      return (
        <div className="flex flex-col items-center py-12">
          <img src={freeOutputCdnUrl} alt="Your Costa Rica photo" className="w-full max-w-lg rounded-2xl shadow-2xl mb-8" />
          <h3 className="text-white text-2xl font-bold mb-2">Your photo is ready!</h3>
          <p className="text-gray-400 mb-8 text-center max-w-md">Download your free watermarked version or unlock the clean HD image.</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href={freeOutputCdnUrl}
              download
              className="px-6 py-3 bg-gray-800 hover:bg-gray-700 text-white rounded-lg font-semibold transition-colors text-center"
            >
              Download Free Photo
            </a>
            <button
              onClick={() => checkoutUrl && window.open(checkoutUrl, '_blank')}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold transition-colors"
            >
              Remove Watermark + HD — $4.99
            </button>
            <button
              onClick={handleBundleCheckout}
              className="px-6 py-3 bg-yellow-600 hover:bg-yellow-500 text-white rounded-lg font-bold transition-colors"
            >
              $9.99 for 3 photos
            </button>
          </div>
          <button onClick={reset} className="mt-6 text-gray-500 hover:text-gray-300 text-sm underline">
            Create another photo
          </button>
        </div>
      );
    }

    if (status === 'payment_pending') {
      return (
        <div className="flex flex-col items-center py-12">
          <img src={freeOutputCdnUrl} alt="Your Costa Rica photo" className="w-full max-w-lg rounded-2xl shadow-2xl mb-8" />
          <h3 className="text-white text-2xl font-bold mb-2">Complete Your Download</h3>
          <p className="text-gray-400 mb-8">Unlock HD quality — no watermarks.</p>
          <div className="flex gap-4">
            <a
              href={freeOutputCdnUrl}
              download
              className="px-6 py-3 bg-gray-800 hover:bg-gray-700 text-white rounded-lg font-semibold transition-colors"
            >
              Download Watermarked
            </a>
            <button
              onClick={() => checkoutUrl && window.open(checkoutUrl, '_blank')}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold transition-colors"
            >
              Complete Your Download
            </button>
          </div>
        </div>
      );
    }

    if (status === 'premium_ready') {
      return (
        <div className="flex flex-col items-center py-12">
          <img src={premiumOutputCdnUrl} alt="Your Costa Rica photo" className="w-full max-w-lg rounded-2xl shadow-2xl mb-8" />
          <h3 className="text-white text-2xl font-bold mb-2">HD Photo Ready!</h3>
          <p className="text-gray-400 mb-8">Your clean, high-resolution image is waiting.</p>
          <div className="flex gap-4">
            <a
              href={premiumOutputCdnUrl}
              download
              className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold transition-colors"
            >
              Download HD Photo
            </a>
            <button
              onClick={handleBundleCheckout}
              className="px-6 py-3 bg-yellow-600 hover:bg-yellow-500 text-white rounded-lg font-bold transition-colors"
            >
              Get 3 more — $9.99
            </button>
          </div>
          <button onClick={reset} className="mt-6 text-gray-500 hover:text-gray-300 text-sm underline">
            Create Another Photo
          </button>
        </div>
      );
    }

    return null;
  };

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">

      {/* SECTION 1 — Hero */}
      <section className="flex flex-col items-center justify-center text-center px-6 py-32 bg-gray-950">
        <h1 className="text-5xl md:text-6xl font-bold text-white mb-6 tracking-tight">
          You in Costa Rica
        </h1>
        <p className="text-lg text-gray-400 max-w-2xl mb-10 leading-relaxed">
          Upload your photo and place yourself inside real Costa Rica travel and wildlife scenes from WildPhotography.
        </p>
        <button
          onClick={scrollToSection2}
          className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-8 py-4 rounded-xl text-lg transition-colors shadow-lg"
        >
          Create My Costa Rica Photo
        </button>
      </section>

      {/* SECTION 2 & 3 — Background Selector + Upload */}
      <section id="background-selector" className="px-6 py-16 max-w-7xl mx-auto">

        {/* Category Tabs */}
        <div className="flex flex-wrap gap-2 mb-8 justify-center">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => { setActiveCategory(cat); setSelectedBackground(null); }}
              className={`px-5 py-2 rounded-full text-sm font-medium transition-colors ${
                activeCategory === cat
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-900 text-gray-400 hover:text-white hover:bg-gray-800 border border-gray-800'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Background Grid */}
        {loadingBackgrounds ? (
          <div className="flex justify-center py-16">
            <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : backgrounds.length === 0 ? (
          <div className="grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 hidden" />
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-12">
            {backgrounds.map((bg) => {
              const isSelected = selectedBackground?.id === bg.id;
              return (
                <button
                  key={bg.id}
                  onClick={() => handleBackgroundSelect(bg)}
                  className={`relative rounded-xl overflow-hidden group transition-all ${
                    isSelected ? 'ring-2 ring-blue-500' : 'hover:ring-1 hover:ring-gray-600'
                  }`}
                >
                  <img
                    src={bg.mediumUrl}
                    alt={bg.title}
                    className="w-full aspect-[4/3] object-cover"
                  />
                  <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 to-transparent p-3">
                    <span className="text-white text-sm font-medium">{bg.title}</span>
                  </div>
                  {isSelected && (
                    <div className="absolute top-2 right-2 bg-blue-600 text-white text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1">
                      ✓ Selected
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Empty state card */}
        {!loadingBackgrounds && backgrounds.length === 0 && (
          <div className="border-2 border-dashed border-gray-800 rounded-xl p-12 text-center text-gray-500">
            More scenes coming soon
          </div>
        )}

        {/* SECTION 3 — Upload (conditional) */}
        {selectedBackground && !currentJobId && (
          <div className="mt-8 flex flex-col lg:flex-row gap-8 items-start">
            {/* Selected background preview */}
            <div className="flex-shrink-0 w-full lg:w-64">
              <img
                src={selectedBackground.mediumUrl}
                alt={selectedBackground.title}
                className="w-full rounded-xl"
              />
              <p className="text-gray-500 text-sm mt-2 text-center">{selectedBackground.title}</p>
            </div>

            {/* Upload zone */}
            <div className="flex-1">
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors ${
                  file ? 'border-blue-500 bg-blue-950/30' : 'border-gray-700 hover:border-gray-500 bg-gray-900'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleFileChange}
                  className="hidden"
                />
                {file ? (
                  <div className="flex flex-col items-center gap-3">
                    <img src={URL.createObjectURL(file)} alt="Preview" className="w-24 h-24 object-cover rounded-lg" />
                    <p className="text-gray-300 font-medium">{file.name}</p>
                    <p className="text-gray-500 text-sm">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                    <p className="text-gray-500 text-xs">Click to change</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-3">
                    <svg className="w-12 h-12 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <p className="text-gray-400 font-medium">Drag & drop your photo or click to browse</p>
                    <p className="text-gray-600 text-sm">JPEG, PNG, or WebP — max 10MB</p>
                  </div>
                )}
              </div>

              {fileError && (
                <p className="text-red-400 text-sm mt-2">{fileError}</p>
              )}

              <div className="mt-5">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={agreed}
                    onChange={(e) => setAgreed(e.target.checked)}
                    className="mt-1 w-4 h-4 accent-blue-600"
                  />
                  <span className="text-gray-400 text-sm">
                    I confirm I have the right to use this photo and understand AI may modify the image.
                  </span>
                </label>
              </div>

              <button
                onClick={handleUpload}
                disabled={!file || !agreed || uploading}
                className={`mt-6 w-full sm:w-auto px-8 py-3 rounded-xl font-bold text-lg transition-colors ${
                  !file || !agreed || uploading
                    ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-500 text-white'
                }`}
              >
                {uploading ? uploadStage : 'Generate My Costa Rica Photo'}
              </button>
            </div>
          </div>
        )}
      </section>

      {/* SECTION 4 — Result Screen */}
      {currentJobId && (
        <section className="px-6 py-8 max-w-4xl mx-auto">
          {renderResult()}
        </section>
      )}

      <footer className="text-center text-gray-700 text-sm py-12 border-t border-gray-900 mt-8">
        <p>WildPhotography — Costa Rica travel photography & AI personalization</p>
      </footer>
    </div>
  );
}