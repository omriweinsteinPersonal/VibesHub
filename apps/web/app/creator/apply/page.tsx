'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ImagePlus,
  Link2,
  MapPin,
  ShoppingBag,
  Tag,
} from 'lucide-react';
import {
  type ChangeEvent,
  type FormEvent,
  type PointerEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
  type WheelEvent,
} from 'react';

import { apiRequest } from '../../../lib/api';
import {
  creatorImageAccept,
  uploadCreatorImage,
} from '../../../lib/recommendation-media';
import { creatorConnectors } from '../../../lib/creator-connectors';
import { suggestCreatorHandle } from '../../../lib/creator-handle';
import {
  type CreatorHandleStatus,
  useCreatorHandleAvailability,
} from '../../../lib/use-creator-handle-availability';

interface CreatorApplication {
  bioText: string | null;
  displayName: string | null;
  feedback: Array<{ createdAt: string; decision: string; publicMessage: string }>;
  id: string;
  primaryCategoryId: string | null;
  requestedHandle: string | null;
  socialLinks: Array<{ followerCount?: number | null; platform: string; url: string }>;
  status: string;
}

interface CreatorProfile {
  version: number;
}
type Step = 1 | 2 | 3 | 4 | 5;
type SocialLink = { followerCount?: number | null; platform: string; url: string };
type ImageLayout = 'full_bleed' | 'central';

const defaultSocialLinks: SocialLink[] = [
  { platform: 'instagram', url: '' },
  { platform: 'tiktok', url: '' },
  { platform: 'apple_music', url: '' },
];

const connectorIconSources: Record<string, string> = {
  apple_music: '/connectors/apple-music.svg',
  facebook: '/connectors/facebook.svg',
  instagram: '/connectors/instagram.svg',
  linkedin: '/connectors/linkedin.svg',
  pinterest: '/connectors/pinterest.svg',
  spotify: '/connectors/spotify.svg',
  tiktok: '/connectors/tiktok.svg',
  x: '/connectors/x.svg',
  youtube: '/connectors/youtube.svg',
};

function ConnectorIcon({ platform, size = 22 }: { platform: string; size?: number }) {
  const src = connectorIconSources[platform];
  return src ? (
    <Image alt="" aria-hidden="true" height={size} src={src} width={size} />
  ) : (
    <Link2 aria-hidden="true" size={size - 2} />
  );
}

const tourSlides = [
  {
    title: 'Add a recommendation',
    description:
      'Share a product or place with a photo, a short note and one clear link.',
    icon: ShoppingBag,
    kind: 'recommendations',
    visual: 'Add recommendation',
  },
  {
    title: 'Add a brand',
    description:
      'Keep the brands you work with in one place for your audience to discover.',
    icon: Tag,
    kind: 'brands',
    visual: 'Add brand',
  },
  {
    title: 'Add media',
    description: 'Bring your recommendations to life with photos and short videos.',
    icon: ImagePlus,
    kind: 'media',
    visual: 'Add media',
  },
  {
    title: 'Add a place',
    description:
      'Turn a favourite location into a recommendation your audience can open in Maps.',
    icon: MapPin,
    kind: 'maps',
    visual: 'Add a place',
  },
] as const;

export default function CreatorApplicationPage() {
  const router = useRouter();
  const [application, setApplication] = useState<CreatorApplication | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [requestedHandle, setRequestedHandle] = useState('');
  const [handleEdited, setHandleEdited] = useState(false);
  const [bioText, setBioText] = useState('');
  const [socialLinks, setSocialLinks] = useState<SocialLink[]>(defaultSocialLinks);
  const [step, setStep] = useState<Step>(1);
  const [tourSlide, setTourSlide] = useState(0);
  const [imageLayout, setImageLayout] = useState<ImageLayout>('full_bleed');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState('');
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [cropSource, setCropSource] = useState('');
  const [cropZoom, setCropZoom] = useState(1);
  const [cropFocusX, setCropFocusX] = useState(50);
  const [cropFocusY, setCropFocusY] = useState(50);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void apiRequest<CreatorApplication | null>('/creator-applications/current')
      .then((current) => {
        setApplication(current);
        if (!current) return;
        setDisplayName(current.displayName ?? '');
        setRequestedHandle(current.requestedHandle ?? '');
        setHandleEdited(Boolean(current.requestedHandle));
        setBioText(current.bioText ?? '');
        setSocialLinks(
          current.socialLinks.length ? current.socialLinks : defaultSocialLinks,
        );
      })
      .catch((cause: unknown) => setError(messageFor(cause)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(
    () => () => {
      if (avatarPreview.startsWith('blob:')) URL.revokeObjectURL(avatarPreview);
    },
    [avatarPreview],
  );

  const handleStatus = useCreatorHandleAvailability({
    currentHandle: application?.requestedHandle,
    endpoint: '/creator-applications/handle-availability',
    handle: requestedHandle,
  });
  const editable =
    !application || ['draft', 'changes_requested'].includes(application.status);
  const latestFeedback = application?.feedback.at(-1);
  const canContinueProfile = Boolean(displayName.trim() && requestedHandle.trim());
  const stepLabel = useMemo(
    () =>
      ['Your profile', 'Image style', 'Social links', 'A quick tour', 'Your page'][
        step - 1
      ],
    [step],
  );

  function chooseAvatar(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (cropSource) URL.revokeObjectURL(cropSource);
    setCropFile(file);
    setCropSource(URL.createObjectURL(file));
    setCropZoom(1);
    setCropFocusX(50);
    setCropFocusY(50);
    setError('');
  }

  async function confirmAvatarCrop() {
    if (!cropFile || !cropSource) return;
    setSaving(true);
    try {
      const cropped = await cropAvatarFile(
        cropSource,
        cropFile.type,
        cropZoom,
        cropFocusX,
        cropFocusY,
      );
      if (avatarPreview.startsWith('blob:')) URL.revokeObjectURL(avatarPreview);
      setAvatarFile(cropped);
      setAvatarPreview(URL.createObjectURL(cropped));
      URL.revokeObjectURL(cropSource);
      setCropFile(null);
      setCropSource('');
    } catch {
      setError('We could not crop that image. Please try another photo.');
    } finally {
      setSaving(false);
    }
  }

  function cancelAvatarCrop() {
    if (cropSource) URL.revokeObjectURL(cropSource);
    setCropFile(null);
    setCropSource('');
  }

  function addSocial(platform: string) {
    setSocialLinks((current) => [...current, { platform, url: '' }]);
  }
  function updateSocial(platform: string, url: string) {
    setSocialLinks((current) =>
      current.map((link) => (link.platform === platform ? { ...link, url } : link)),
    );
  }
  function removeSocial(platform: string) {
    setSocialLinks((current) => current.filter((link) => link.platform !== platform));
  }

  async function saveDraft() {
    const handle = (requestedHandle || suggestCreatorHandle(displayName)).trim();
    const payload = {
      bioText: bioText.trim() || null,
      displayName: displayName.trim() || null,
      requestedHandle: handle || null,
      socialLinks: socialLinks.filter((link) => link.url.trim()),
    };
    const draft = application
      ? await apiRequest<CreatorApplication>(`/creator-applications/${application.id}`, {
          body: JSON.stringify(payload),
          method: 'PATCH',
        })
      : await apiRequest<CreatorApplication>('/creator-applications', {
          body: JSON.stringify(payload),
          idempotent: true,
          method: 'POST',
        });
    setApplication(draft);
    return draft;
  }

  async function goNext() {
    setError('');
    if (step === 1 && !canContinueProfile) {
      setError('Add a display name and a storefront address to continue.');
      return;
    }
    if (step === 3 && socialLinks.some((link) => !link.url.trim())) {
      setError('Complete or remove each social link before continuing.');
      return;
    }
    setSaving(true);
    try {
      if ([1, 3].includes(step)) await saveDraft();
      setStep((current) => (current < 5 ? ((current + 1) as Step) : current));
    } catch (cause) {
      setError(messageFor(cause));
    } finally {
      setSaving(false);
    }
  }

  async function finish(event: FormEvent) {
    event.preventDefault();
    setError('');
    if (!canContinueProfile) {
      setStep(1);
      setError('Add a display name and a storefront address to continue.');
      return;
    }
    if (socialLinks.some((link) => !link.url.trim())) {
      setStep(3);
      setError('Complete or remove each social link before continuing.');
      return;
    }
    setSaving(true);
    try {
      const draft = await saveDraft();
      const submitted = await apiRequest<CreatorApplication>(
        `/creator-applications/${draft.id}/submit`,
        { idempotent: true, method: 'POST' },
      );
      setApplication(submitted);
      if (avatarFile) {
        try {
          const asset = await uploadCreatorImage(avatarFile, () => undefined);
          const profile = await apiRequest<CreatorProfile>('/creator/profile');
          await apiRequest('/creator/profile', {
            body: JSON.stringify({ avatarAssetId: asset.id }),
            headers: { 'if-match': `"${profile.version}"` },
            method: 'PATCH',
          });
        } catch {
          /* The image can still be added from Creator Profile. */
        }
      }
      router.push('/creator-home');
    } catch (cause) {
      setError(messageFor(cause));
    } finally {
      setSaving(false);
    }
  }

  function goBack() {
    setError('');
    setStep((current) => (current > 1 ? ((current - 1) as Step) : current));
  }

  return (
    <main className="onboardingPage">
      <header className="onboardingHeader">
        <Link className="onboardingBrand" href="/" aria-label="swavii home">
          <Image
            src="/images/home/swavii-logo.png"
            alt="swavii"
            width={154}
            height={121}
            priority
          />
        </Link>
      </header>
      <section className="onboardingShell">
        <div className="onboardingIntro">
          <p className="eyebrow">CREATOR ONBOARDING</p>
          <h1>{step === 5 ? 'Your page is taking shape.' : 'Let’s build your page.'}</h1>
          <p>
            Set up your Swavii space in a few thoughtful steps. You can keep shaping it
            from your studio.
          </p>
        </div>
        <div aria-label={`Step ${step} of 5`} className="onboardingProgress">
          {[1, 2, 3, 4, 5].map((item) => (
            <span className={item <= step ? 'active' : ''} key={item}>
              <b>{item < step ? <Check aria-hidden="true" size={14} /> : item}</b>
              {item === step ? stepLabel : null}
            </span>
          ))}
        </div>
        {latestFeedback ? (
          <div className="statusBanner">
            <strong>Message from the Swavii review team</strong>
            <p>{latestFeedback.publicMessage}</p>
          </div>
        ) : null}
        {loading ? <p>Loading your setup…</p> : null}
        {!loading && !editable ? (
          <section className="onboardingCard onboardingStatusCard">
            <p className="eyebrow">SETUP STATUS</p>
            <h2>Your creator setup is {application?.status.replaceAll('_', ' ')}.</h2>
            <p className="onboardingLead">
              We&apos;ll keep your details safe here while the next step is being
              prepared.
            </p>
          </section>
        ) : null}
        {!loading && editable ? (
          <form className="onboardingCard onboardingJourneyCard" onSubmit={finish}>
            {step === 1 ? (
              <ProfileStep
                displayName={displayName}
                requestedHandle={requestedHandle}
                bioText={bioText}
                avatarPreview={avatarPreview}
                handleEdited={handleEdited}
                handleStatus={handleStatus}
                onAvatar={chooseAvatar}
                onDisplayName={(value) => {
                  setDisplayName(value);
                  if (!handleEdited) setRequestedHandle(suggestCreatorHandle(value));
                }}
                onHandle={(value) => {
                  setHandleEdited(true);
                  setRequestedHandle(value);
                }}
                onBio={setBioText}
              />
            ) : null}
            {step === 2 ? (
              <ImageStyleStep
                avatarPreview={avatarPreview}
                handle={requestedHandle}
                imageLayout={imageLayout}
                onLayout={setImageLayout}
              />
            ) : null}
            {step === 3 ? (
              <SocialStep
                socialLinks={socialLinks}
                onAdd={addSocial}
                onRemove={removeSocial}
                onUpdate={updateSocial}
              />
            ) : null}
            {step === 4 ? (
              <TourStep
                slide={tourSlides[tourSlide] ?? tourSlides[0]}
                slideIndex={tourSlide}
                onSkip={() => setStep(5)}
              />
            ) : null}
            {step === 5 ? (
              <PagePreviewStep
                displayName={displayName}
                handle={requestedHandle}
                bioText={bioText}
                avatarPreview={avatarPreview}
                imageLayout={imageLayout}
                socialLinks={socialLinks}
              />
            ) : null}
            {error ? (
              <p className="formError" role="alert">
                {error}
              </p>
            ) : null}
            <div className="onboardingActions">
              {step > 1 ? (
                <button
                  className="button secondary"
                  disabled={saving}
                  onClick={goBack}
                  type="button"
                >
                  <ArrowLeft aria-hidden="true" size={16} />
                  Back
                </button>
              ) : (
                <span />
              )}
              {step === 4 ? (
                <span className="tourActions">
                  <button
                    className="button primary"
                    onClick={() => {
                      if (tourSlide === tourSlides.length - 1) setStep(5);
                      else setTourSlide((value) => value + 1);
                    }}
                    type="button"
                  >
                    {tourSlide === tourSlides.length - 1 ? 'See my page' : 'Next'}
                    <ArrowRight aria-hidden="true" size={16} />
                  </button>
                </span>
              ) : null}
              {step < 4 ? (
                <button
                  className="button primary"
                  disabled={saving || (step === 1 && handleStatus !== 'available')}
                  onClick={() => void goNext()}
                  type="button"
                >
                  {saving ? 'Saving…' : 'Continue'}
                  <ArrowRight aria-hidden="true" size={16} />
                </button>
              ) : null}
              {step === 5 ? (
                <button className="button primary" disabled={saving} type="submit">
                  {saving ? 'Opening your studio…' : 'Open my studio'}
                  <ArrowRight aria-hidden="true" size={16} />
                </button>
              ) : null}
            </div>
          </form>
        ) : null}
      </section>
      {cropSource ? (
        <AvatarCropModal
          focusX={cropFocusX}
          focusY={cropFocusY}
          onCancel={cancelAvatarCrop}
          onConfirm={() => void confirmAvatarCrop()}
          onFocusX={setCropFocusX}
          onFocusY={setCropFocusY}
          onZoom={setCropZoom}
          source={cropSource}
          zoom={cropZoom}
        />
      ) : null}
    </main>
  );
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

async function cropAvatarFile(
  source: string,
  mimeType: string,
  zoom: number,
  focusX: number,
  focusY: number,
): Promise<File> {
  const image = document.createElement('img');
  image.src = source;
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error('IMAGE_LOAD_FAILED'));
  });
  const cropSize = Math.min(image.naturalWidth, image.naturalHeight) / zoom;
  const sourceX = (image.naturalWidth - cropSize) * (focusX / 100);
  const sourceY = (image.naturalHeight - cropSize) * (focusY / 100);
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 1024;
  canvas
    .getContext('2d')
    ?.drawImage(image, sourceX, sourceY, cropSize, cropSize, 0, 0, 1024, 1024);
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, mimeType === 'image/png' ? 'image/png' : 'image/jpeg', 0.92),
  );
  if (!blob) throw new Error('IMAGE_CROP_FAILED');
  return new File([blob], 'creator-profile-image.jpg', { type: blob.type });
}

function AvatarCropModal({
  focusX,
  focusY,
  onCancel,
  onConfirm,
  onFocusX,
  onFocusY,
  onZoom,
  source,
  zoom,
}: {
  focusX: number;
  focusY: number;
  onCancel: () => void;
  onConfirm: () => void;
  onFocusX: (value: number) => void;
  onFocusY: (value: number) => void;
  onZoom: (value: number) => void;
  source: string;
  zoom: number;
}) {
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const dragStart = useRef({ focusX, focusY, x: 0, y: 0 });
  const pinchStart = useRef<{ distance: number; zoom: number } | null>(null);

  function getDistance() {
    const active = [...pointers.current.values()];
    if (active.length < 2) return 0;
    return Math.hypot(active[0]!.x - active[1]!.x, active[0]!.y - active[1]!.y);
  }

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.current.size === 1) {
      dragStart.current = { focusX, focusY, x: event.clientX, y: event.clientY };
    } else if (pointers.current.size === 2) {
      pinchStart.current = { distance: getDistance(), zoom };
    }
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!pointers.current.has(event.pointerId)) return;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.current.size >= 2 && pinchStart.current) {
      const distance = getDistance();
      if (distance > 0) {
        onZoom(
          clamp(pinchStart.current.zoom * (distance / pinchStart.current.distance), 1, 3),
        );
      }
      return;
    }
    const viewport = event.currentTarget.getBoundingClientRect();
    onFocusX(
      clamp(
        dragStart.current.focusX -
          ((event.clientX - dragStart.current.x) / viewport.width) * 100,
        0,
        100,
      ),
    );
    onFocusY(
      clamp(
        dragStart.current.focusY -
          ((event.clientY - dragStart.current.y) / viewport.height) * 100,
        0,
        100,
      ),
    );
  }

  function handlePointerUp(event: PointerEvent<HTMLDivElement>) {
    pointers.current.delete(event.pointerId);
    pinchStart.current = null;
    if (pointers.current.size === 1) {
      const remaining = [...pointers.current.values()][0];
      if (remaining) {
        dragStart.current = { focusX, focusY, x: remaining.x, y: remaining.y };
      }
    }
  }

  function handleWheel(event: WheelEvent<HTMLDivElement>) {
    event.preventDefault();
    onZoom(clamp(zoom - event.deltaY * 0.002, 1, 3));
  }

  return (
    <div aria-label="Crop profile image" className="avatarCropOverlay" role="dialog">
      <div className="avatarCropDialog">
        <div className="avatarCropHeader">
          <div>
            <p className="eyebrow">PROFILE IMAGE</p>
            <h2>Frame your photo.</h2>
          </div>
          <button
            aria-label="Close image cropper"
            className="avatarCropClose"
            onClick={onCancel}
            type="button"
          >
            ×
          </button>
        </div>
        <div
          aria-label="Drag the photo to position it"
          className="avatarCropViewport"
          onPointerCancel={handlePointerUp}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onWheel={handleWheel}
          role="application"
        >
          <img
            alt="Crop preview"
            src={source}
            style={{
              objectPosition: `${focusX}% ${focusY}%`,
              transform: `scale(${zoom})`,
            }}
          />
          <span className="avatarCropGuide" />
        </div>
        <label className="avatarCropControl">
          Zoom in or out
          <input
            max="3"
            min="1"
            onChange={(event) => onZoom(Number(event.target.value))}
            step="0.05"
            type="range"
            value={zoom}
          />
        </label>
        <p className="avatarCropHint">
          Drag the photo to position it. Pinch or use the slider to zoom.
          <br />
          Only the area inside the circle will be saved.
        </p>
        <div className="avatarCropActions">
          <button className="button secondary" onClick={onCancel} type="button">
            Cancel
          </button>
          <button className="button primary" onClick={onConfirm} type="button">
            Use this crop
          </button>
        </div>
      </div>
    </div>
  );
}

function ProfileStep({
  displayName,
  requestedHandle,
  bioText,
  avatarPreview,
  handleEdited,
  handleStatus,
  onAvatar,
  onDisplayName,
  onHandle,
  onBio,
}: {
  displayName: string;
  requestedHandle: string;
  bioText: string;
  avatarPreview: string;
  handleEdited: boolean;
  handleStatus: CreatorHandleStatus;
  onAvatar: (event: ChangeEvent<HTMLInputElement>) => void;
  onDisplayName: (value: string) => void;
  onHandle: (value: string) => void;
  onBio: (value: string) => void;
}) {
  return (
    <section aria-labelledby="onboarding-profile-title">
      <p className="eyebrow">01 / PROFILE</p>
      <h2 id="onboarding-profile-title">Create your profile</h2>
      <p className="onboardingLead">
        Share a few details to get started on your Swavii link in bio.
      </p>
      <div className="onboardingAvatarRow">
        <label className="onboardingAvatar" aria-label="Upload profile image">
          {avatarPreview ? (
            <img alt="Profile preview" src={avatarPreview} />
          ) : (
            <ImagePlus aria-hidden="true" size={22} />
          )}
          <input accept={creatorImageAccept} onChange={onAvatar} type="file" />
        </label>
        <small className="fieldHint">
          Tap the circle to upload · JPEG, PNG or WebP up to 5 MB.
        </small>
      </div>
      <div className="fieldGrid">
        <label>
          Creator name
          <input
            autoComplete="name"
            maxLength={100}
            onChange={(event) => onDisplayName(event.target.value)}
            required
            value={displayName}
          />
        </label>
        <label>
          @handle
          <input
            aria-describedby="onboarding-handle-status"
            autoComplete="url"
            maxLength={100}
            onChange={(event) => onHandle(event.target.value)}
            required
            value={requestedHandle}
          />
          <small className="fieldHint" id="onboarding-handle-status">
            {handleMessage(handleStatus, requestedHandle)}
          </small>
        </label>
      </div>
      <label>
        Bio <span className="optionalLabel">Optional</span>
        <textarea
          dir="auto"
          maxLength={1000}
          onChange={(event) => onBio(event.target.value)}
          placeholder="Fashion, beauty and everyday finds…"
          rows={5}
          value={bioText}
        />
      </label>
      {!handleEdited && requestedHandle ? (
        <small className="fieldHint">
          We suggested this handle from your creator name. You can change it.
        </small>
      ) : null}
    </section>
  );
}

function ImageStyleStep({
  avatarPreview,
  handle,
  imageLayout,
  onLayout,
}: {
  avatarPreview: string;
  handle: string;
  imageLayout: ImageLayout;
  onLayout: (layout: ImageLayout) => void;
}) {
  return (
    <section aria-labelledby="onboarding-image-title">
      <p className="eyebrow">02 / IMAGE STYLE</p>
      <h2 id="onboarding-image-title">Choose your image style.</h2>
      <p className="onboardingLead">
        Choose how your profile image is displayed on your page.
      </p>
      <div className={`imageStyleHero ${imageLayout}`}>
        <div className="imageStylePagePreview">
          <div className="imageStylePageImage">
            {avatarPreview ? (
              <img alt="Uploaded profile preview" src={avatarPreview} />
            ) : (
              <span>S</span>
            )}
          </div>
          <div className="imageStylePageAvatar">
            {avatarPreview ? <img alt="" src={avatarPreview} /> : <span>S</span>}
          </div>
          <strong>@{handle || 'your_handle'}</strong>
          <small>Really love sharing finds</small>
          <div className="imageStylePageSocials">
            <ConnectorIcon platform="instagram" size={18} />
            <ConnectorIcon platform="youtube" size={18} />
            <ConnectorIcon platform="apple_music" size={18} />
            <ConnectorIcon platform="tiktok" size={18} />
          </div>
          <div className="imageStylePageTabs">
            <span>All</span>
            <span>Fashion</span>
            <span>Sports</span>
            <span>Random</span>
            <span>Food</span>
            <span>Travel</span>
          </div>
        </div>
      </div>
      <div className="imageStyleChoices">
        <button
          className={imageLayout === 'full_bleed' ? 'selected' : ''}
          onClick={() => onLayout('full_bleed')}
          type="button"
        >
          <span className="imageStyleThumb fullBleedThumb">
            {avatarPreview ? <img alt="" src={avatarPreview} /> : null}
          </span>
          <strong>Full bleed</strong>
          <small>Showcase your photo across the page.</small>
          {imageLayout === 'full_bleed' ? <Check aria-hidden="true" size={17} /> : null}
        </button>
        <button
          className={imageLayout === 'central' ? 'selected' : ''}
          onClick={() => onLayout('central')}
          type="button"
        >
          <span className="imageStyleThumb centralThumb">
            {avatarPreview ? <img alt="" src={avatarPreview} /> : null}
          </span>
          <strong>Central</strong>
          <small>Keep the image centered above your page.</small>
          {imageLayout === 'central' ? <Check aria-hidden="true" size={17} /> : null}
        </button>
      </div>
    </section>
  );
}

function SocialStep({
  socialLinks,
  onAdd,
  onRemove,
  onUpdate,
}: {
  socialLinks: SocialLink[];
  onAdd: (platform: string) => void;
  onRemove: (platform: string) => void;
  onUpdate: (platform: string, url: string) => void;
}) {
  return (
    <section aria-labelledby="onboarding-links-title">
      <p className="eyebrow">03 / SOCIAL LINKS</p>
      <h2 id="onboarding-links-title">Connect your audience.</h2>
      <p className="onboardingLead">
        Add the places where people already follow your work.
      </p>
      {socialLinks.length ? (
        <div className="onboardingSocialList">
          {socialLinks.map((link) => (
            <div className="onboardingSocialRow" key={link.platform}>
              <div className="onboardingSocialMain">
                <span className={`onboardingSocialIcon ${link.platform}`}>
                  <ConnectorIcon platform={link.platform} />
                </span>
                <div className="onboardingSocialCopy">
                  <strong>
                    {creatorConnectors.find(
                      (connector) => connector.platform === link.platform,
                    )?.label ?? link.platform}
                  </strong>
                  <span>Paste your profile link</span>
                </div>
                <button
                  aria-label={`Remove ${link.platform}`}
                  className="onboardingSocialRemove"
                  onClick={() => onRemove(link.platform)}
                  type="button"
                >
                  ×
                </button>
              </div>
              <label className="onboardingSocialInput">
                <input
                  autoComplete="url"
                  onChange={(event) => onUpdate(link.platform, event.target.value)}
                  placeholder={
                    creatorConnectors.find(
                      (connector) => connector.platform === link.platform,
                    )?.placeholder
                  }
                  required
                  type="url"
                  value={link.url}
                />
              </label>
            </div>
          ))}
        </div>
      ) : (
        <p className="onboardingEmpty">
          No links added yet. Choose one below to get started.
        </p>
      )}
      <div aria-label="Add a social link" className="onboardingChoices">
        {creatorConnectors
          .filter(
            ({ platform }) => !socialLinks.some((link) => link.platform === platform),
          )
          .map(({ label, platform }) => (
            <button key={platform} onClick={() => onAdd(platform)} type="button">
              <ConnectorIcon platform={platform} size={18} />
              {label}
            </button>
          ))}
      </div>
    </section>
  );
}

function TourStep({
  slide,
  slideIndex,
  onSkip,
}: {
  slide: (typeof tourSlides)[number];
  slideIndex: number;
  onSkip: () => void;
}) {
  return (
    <section aria-labelledby="onboarding-tour-title" className="tourStep">
      <div className="tourMeta">
        <span>0{slideIndex + 1} / 04</span>
        <button className="textButton" onClick={onSkip} type="button">
          Skip tour
        </button>
      </div>
      <div className={`tourIllustration ${slide.kind}`}>
        <div className="tourScreen">
          <div className="tourScreenHeader">
            <span>swavii studio</span>
            <span className="tourScreenAvatar" />
          </div>
          <div className="tourScreenBody">
            <div className="tourScreenTitle">
              <strong>{slide.visual}</strong>
              <span>+</span>
            </div>
            <div className="tourScreenRows">
              <span />
              <span />
              <span />
            </div>
          </div>
        </div>
      </div>
      <h2 id="onboarding-tour-title">{slide.title}</h2>
      <p className="onboardingLead">{slide.description}</p>
      <div className="tourDots" aria-hidden="true">
        {tourSlides.map((item, index) => (
          <span className={index === slideIndex ? 'active' : ''} key={item.kind} />
        ))}
      </div>
    </section>
  );
}

function PagePreviewStep({
  displayName,
  handle,
  bioText,
  avatarPreview,
  imageLayout,
  socialLinks,
}: {
  displayName: string;
  handle: string;
  bioText: string;
  avatarPreview: string;
  imageLayout: ImageLayout;
  socialLinks: SocialLink[];
}) {
  return (
    <section aria-labelledby="onboarding-preview-title" className="previewStep">
      <p className="eyebrow">05 / YOUR PAGE</p>
      <h2 id="onboarding-preview-title">See your page.</h2>
      <p className="onboardingLead">
        This is how your Swavii creator page will look with your links and
        recommendations.
      </p>
      <div className={`creatorPagePreview ${imageLayout}`}>
        <div className="creatorPreviewHeader">
          <span>swavii</span>
          <span>⋯</span>
        </div>
        <div className="creatorPreviewHero">
          {avatarPreview ? (
            <img alt="" src={avatarPreview} />
          ) : (
            <span>{displayName.slice(0, 1).toUpperCase() || 'S'}</span>
          )}
        </div>
        <div className="creatorPreviewBody">
          <div className="creatorPreviewIdentity">
            <span className="creatorPreviewAvatar">
              {avatarPreview ? (
                <img alt="" src={avatarPreview} />
              ) : (
                displayName.slice(0, 1).toUpperCase() || 'S'
              )}
            </span>
            <div>
              <strong>{displayName || 'Your name'}</strong>
              <small>@{handle || 'yourhandle'}</small>
            </div>
          </div>
          <div className="creatorPreviewSocials">
            {socialLinks.slice(0, 4).map((link) => (
              <span key={link.platform}>
                <ConnectorIcon platform={link.platform} size={16} />
              </span>
            ))}
          </div>
          <p>{bioText || 'Your bio will appear here.'}</p>
          <div className="creatorPreviewSection">
            <div>
              <strong>My recommendations</strong>
              <small>See all →</small>
            </div>
            <div className="creatorPreviewCards">
              <span />
              <span />
              <span />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function handleMessage(status: CreatorHandleStatus, handle: string): string {
  if (!handle) return 'This becomes your public address on Swavii.';
  if (status === 'checking') return 'Checking address availability…';
  if (status === 'available') return `swavii.com/${handle} is available`;
  if (status === 'unavailable') return 'That address is already taken.';
  if (status === 'invalid')
    return 'Use your preferred name or handle. Avoid URL separators such as / or ?.';
  return `Your page will live at swavii.com/${handle}`;
}

function messageFor(cause: unknown) {
  return cause instanceof Error ? cause.message : 'Could not save your creator setup.';
}
