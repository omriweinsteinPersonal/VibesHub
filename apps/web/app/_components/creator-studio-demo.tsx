'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';
import { ArrowRight, Check, Layers, Palette, Pause, Play, Tags } from 'lucide-react';
import styles from './creator-studio-demo.module.css';

const categories = [
  {
    title: 'Curate collections',
    detail: 'Bring your favorite finds together.',
    icon: Layers,
  },
  {
    title: 'Customize your feed',
    detail: 'Your colors. Your atmosphere.',
    icon: Palette,
  },
  { title: 'Shape every label', detail: 'Organize picks your way.', icon: Tags },
];
const steps = ['Add a pick', 'Build a collection', 'See it in your store'];
const products = [
  { name: 'Everyday shoulder bag', image: '/images/creator-demo-shoulder-bag.png' },
  { name: 'My favorite sneakers', image: '/images/creator-demo-sneakers.png' },
  { name: 'Sculptural gold hoops', image: '/images/creator-demo-earrings.png' },
] as const;

export function CreatorStudioDemo() {
  const [category, setCategory] = useState(0);
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [tone, setTone] = useState(0);
  const [label, setLabel] = useState('All');

  useEffect(() => {
    if (
      !playing ||
      category !== 0 ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    )
      return;
    const timer = window.setInterval(() => setStep((current) => (current + 1) % 3), 5500);
    return () => window.clearInterval(timer);
  }, [playing, category]);

  const advance = () => {
    setPlaying(false);
    setStep((step + 1) % 3);
  };
  return (
    <div className={styles.demo}>
      <div className={styles.categories} aria-label="Explore creator features">
        {categories.map(({ title, detail, icon: Icon }, index) => (
          <button
            type="button"
            key={title}
            aria-pressed={category === index}
            onClick={() => {
              setCategory(index);
              setStep(0);
            }}
          >
            <Icon size={22} aria-hidden="true" />
            <strong>{title}</strong>
            <span>{detail}</span>
          </button>
        ))}
      </div>
      <div className={styles.stage}>
        <aside className={styles.guide}>
          <span className={styles.eyebrow}>MAYA’S CREATOR STUDIO · INTERACTIVE DEMO</span>
          <h3>{categories[category]?.title}</h3>
          <p>
            {category === 0
              ? 'From a favorite find to a collection your audience can explore.'
              : category === 1
                ? 'Choose a palette and see Maya’s page take on a new mood.'
                : 'Give every interest a home. Switch labels to explore Maya’s picks.'}
          </p>
          {category === 0 ? (
            <>
              <div className={styles.steps}>
                {steps.map((name, index) => (
                  <button
                    type="button"
                    key={name}
                    aria-pressed={step === index}
                    onClick={() => {
                      setStep(index);
                      setPlaying(false);
                    }}
                  >
                    <span>{index + 1}</span>
                    {name}
                    <ArrowRight size={16} aria-hidden="true" />
                  </button>
                ))}
              </div>
              <button
                className={styles.play}
                type="button"
                onClick={() => setPlaying(!playing)}
              >
                {playing ? <Pause size={14} /> : <Play size={14} />}
                {playing ? 'Pause demo' : 'Play demo'}
              </button>
            </>
          ) : category === 1 ? (
            <div className={styles.swatches}>
              {['#f6efe3', '#e0e6d5', '#eedee1'].map((color, index) => (
                <button
                  type="button"
                  key={color}
                  style={{ background: color }}
                  aria-label={['Warm sand', 'Soft sage', 'Rose'][index]}
                  aria-pressed={tone === index}
                  onClick={() => setTone(index)}
                >
                  {tone === index ? <Check size={18} /> : null}
                </button>
              ))}
            </div>
          ) : (
            <p className={styles.hint}>Try the labels above the products →</p>
          )}
        </aside>
        <div className={styles.canvas}>
          {category === 0 && step < 2 ? (
            <div className={styles.editor} key={step}>
              <span className={styles.eyebrow}>CREATOR DASHBOARD</span>
              <h4>{step === 0 ? 'Add recommendation' : 'Create collection'}</h4>
              {step === 0 ? (
                <>
                  <div className={styles.field}>
                    <span>
                      Item link <small>Optional</small>
                    </span>
                    <div>Paste a link, or add your own details</div>
                  </div>
                  <div className={styles.pick}>
                    <Image
                      src={products[0].image}
                      alt={products[0].name}
                      width={110}
                      height={130}
                    />
                    <div>
                      <div className={styles.field}>
                        <span>Item name</span>
                        <div>{products[0].name}</div>
                      </div>
                      <div className={styles.field}>
                        <span>Brand</span>
                        <div>Maya’s favorites</div>
                      </div>
                    </div>
                  </div>
                  <button className={styles.primary} type="button" onClick={advance}>
                    Save recommendation <ArrowRight size={15} />
                  </button>
                </>
              ) : (
                <>
                  <div className={styles.field}>
                    <span>Collection name</span>
                    <div>Everyday favorites</div>
                  </div>
                  <span className={styles.selectionLabel}>
                    Choose your recommendations
                  </span>
                  {products.map((product) => (
                    <div className={styles.selection} key={product.name}>
                      <Image src={product.image} alt="" width={44} height={48} />
                      <span>{product.name}</span>
                      <Check size={17} aria-label="Selected" />
                    </div>
                  ))}
                  <button className={styles.primary} type="button" onClick={advance}>
                    Create collection <ArrowRight size={15} />
                  </button>
                </>
              )}
            </div>
          ) : (
            <div
              className={styles.store}
              style={{ background: ['#f6efe3', '#e0e6d5', '#eedee1'][tone] }}
            >
              <header className={styles.profile}>
                <Image
                  src="/images/creator-maya-avatar.png"
                  alt="Maya Cohen"
                  width={56}
                  height={56}
                />
                <div>
                  <h4>Maya Cohen</h4>
                  <span>Lifestyle · @just_maya</span>
                </div>
              </header>
              <p className={styles.bio}>
                Good taste, daily aesthetics, and little things I love.
              </p>
              <div className={styles.socials}>
                {['instagram', 'tiktok', 'youtube'].map((name) => (
                  <Image
                    key={name}
                    src={`/connectors/${name}.svg`}
                    alt={name}
                    width={20}
                    height={20}
                  />
                ))}
              </div>
              <div className={styles.feed}>
                <div className={styles.labels}>
                  {['All', 'My closet', 'Random'].map((name) => (
                    <button
                      type="button"
                      key={name}
                      aria-pressed={label === name}
                      onClick={() => setLabel(name)}
                    >
                      {name}
                    </button>
                  ))}
                </div>
                <span className={styles.eyebrow}>MAYA’S FAVORITES</span>
                <h4>
                  {label === 'Random' ? 'Little things I love' : 'Everyday favorites'}
                </h4>
                <p className={styles.caption}>
                  {category === 0
                    ? 'Your collection, ready to explore.'
                    : 'Picked and shared by Maya.'}
                </p>
                <div className={styles.products}>
                  {(label === 'Random'
                    ? products.slice(2)
                    : label === 'My closet'
                      ? products.slice(0, 2)
                      : products
                  ).map((product) => (
                    <article key={product.name}>
                      <Image
                        src={product.image}
                        alt={product.name}
                        width={180}
                        height={210}
                      />
                      <span>{product.name}</span>
                    </article>
                  ))}
                </div>
                {category === 0 ? (
                  <button className={styles.replay} type="button" onClick={advance}>
                    Replay the steps ↻
                  </button>
                ) : null}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
