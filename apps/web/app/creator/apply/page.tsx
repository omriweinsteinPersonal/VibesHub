'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Check,
  ImagePlus,
  Link2,
  MapPin,
  ShoppingBag,
  Sparkles,
} from 'lucide-react';
import { type ChangeEvent, type FormEvent, useEffect, useMemo, useState } from 'react';

import { apiRequest } from '../../../lib/api';
import {
  creatorImageAccept,
  uploadCreatorImage,
} from '../../../lib/recommendation-media';
import { creatorConnectors } from '../../../lib/creator-connectors';
import { isCreatorHandle, suggestCreatorHandle } from '../../../lib/creator-handle';
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
type ImageLayout = 'full_bleed' | 'standard';

const tourSlides = [
  {
    title: 'Your recommendations',
    description: 'Share the products and places you love, all in one beautiful space.',
    icon: ShoppingBag,
    kind: 'recommendations',
  },
  {
    title: 'Bring your audience with you',
    description:
      'Connect your social platforms so your community can find you everywhere.',
    icon: Link2,
    kind: 'social',
  },
  {
    title: 'Save your favourite places',
    description:
      'Add maps and places to turn your personal discoveries into recommendations.',
    icon: MapPin,
    kind: 'maps',
  },
  {
    title: 'See what resonates',
    description: 'Use insights to understand what your audience loves most.',
    icon: BarChart3,
    kind: 'analytics',
  },
] as const;

export default function CreatorApplicationPage() {
  const router = useRouter();
  const [application, setApplication] = useState<CreatorApplication | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [requestedHandle, setRequestedHandle] = useState('');
  const [handleEdited, setHandleEdited] = useState(false);
  const [bioText, setBioText] = useState('');
  const [socialLinks, setSocialLinks] = useState<SocialLink[]>([]);
  const [step, setStep] = useState<Step>(1);
  const [tourSlide, setTourSlide] = useState(0);
  const [imageLayout, setImageLayout] = useState<ImageLayout>('full_bleed');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState('');
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
        setSocialLinks(current.socialLinks);
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
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
    setError('');
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
    if (step === 1 && (!canContinueProfile || !isCreatorHandle(requestedHandle))) {
      setError('Add a display name and an available storefront address to continue.');
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
    if (!canContinueProfile || !isCreatorHandle(requestedHandle)) {
      setStep(1);
      setError('Add a display name and an available storefront address to continue.');
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
          <span className="onboardingBrandMark">
            <Sparkles aria-hidden="true" size={15} />
          </span>
          <span>swavii</span>
        </Link>
        <Link href="/account">Save &amp; exit</Link>
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
                imageLayout={imageLayout}
                onLayout={setImageLayout}
                onAvatar={chooseAvatar}
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
              {step > 1 && step !== 4 ? (
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
                    className="button secondary"
                    disabled={tourSlide === 0}
                    onClick={() => setTourSlide((value) => Math.max(0, value - 1))}
                    type="button"
                  >
                    <ArrowLeft aria-hidden="true" size={16} />
                    Back
                  </button>
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
    </main>
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
        Share a few details to get started on your Swavii creator page.
      </p>
      <div className="onboardingAvatarRow">
        <div className="onboardingAvatar">
          {avatarPreview ? (
            <img alt="Profile preview" src={avatarPreview} />
          ) : (
            <ImagePlus aria-hidden="true" size={22} />
          )}
          <label className="avatarCameraButton" aria-label="Upload profile image">
            <ImagePlus aria-hidden="true" size={16} />
            <input accept={creatorImageAccept} onChange={onAvatar} type="file" />
          </label>
        </div>
        <div>
          <label className="button secondary onboardingUpload">
            {avatarPreview ? 'Change profile image' : 'Upload profile image'}
            <input accept={creatorImageAccept} onChange={onAvatar} type="file" />
          </label>
          <small className="fieldHint">JPEG, PNG or WebP up to 5 MB.</small>
        </div>
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
            maxLength={30}
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
  imageLayout,
  onLayout,
  onAvatar,
}: {
  avatarPreview: string;
  imageLayout: ImageLayout;
  onLayout: (layout: ImageLayout) => void;
  onAvatar: (event: ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <section aria-labelledby="onboarding-image-title">
      <p className="eyebrow">02 / IMAGE STYLE</p>
      <h2 id="onboarding-image-title">Choose your image style.</h2>
      <p className="onboardingLead">
        Choose how your profile image is displayed on your page.
      </p>
      <div className="imageStyleHero">
        {avatarPreview ? (
          <img alt="Uploaded profile preview" src={avatarPreview} />
        ) : (
          <label className="imageStyleEmpty">
            <ImagePlus aria-hidden="true" size={26} />
            <span>Upload a profile image first</span>
            <input accept={creatorImageAccept} onChange={onAvatar} type="file" />
          </label>
        )}
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
          className={imageLayout === 'standard' ? 'selected' : ''}
          onClick={() => onLayout('standard')}
          type="button"
        >
          <span className="imageStyleThumb standardThumb">
            {avatarPreview ? <img alt="" src={avatarPreview} /> : null}
          </span>
          <strong>Standard</strong>
          <small>Display a centered profile image.</small>
          {imageLayout === 'standard' ? <Check aria-hidden="true" size={17} /> : null}
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
              <span className="onboardingSocialIcon">
                <Link2 aria-hidden="true" size={17} />
              </span>
              <label>
                {creatorConnectors.find(
                  (connector) => connector.platform === link.platform,
                )?.label ?? link.platform}
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
              <button
                aria-label={`Remove ${link.platform}`}
                className="textButton"
                onClick={() => onRemove(link.platform)}
                type="button"
              >
                Remove
              </button>
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
              <Link2 aria-hidden="true" size={16} />
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
  const Icon = slide.icon;
  return (
    <section aria-labelledby="onboarding-tour-title" className="tourStep">
      <div className="tourMeta">
        <span>0{slideIndex + 1} / 04</span>
        <button className="textButton" onClick={onSkip} type="button">
          Skip tour
        </button>
      </div>
      <div className={`tourIllustration ${slide.kind}`}>
        <Icon aria-hidden="true" size={42} />
        <div className="tourIllustrationCards">
          <span />
          <span />
          <span />
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
                <Link2 aria-hidden="true" size={13} />
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
    return 'Use 2–30 characters: letters, numbers, underscores or hyphens.';
  return `Your page will live at swavii.com/${handle}`;
}

function messageFor(cause: unknown) {
  return cause instanceof Error ? cause.message : 'Could not save your creator setup.';
}
