export default function Support() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-24">

      {/* Hero */}
      <div className="text-center">
        <span className="inline-block rounded-full bg-peach-100 px-4 py-1.5 text-sm font-semibold text-coral-600">
          Support the work
        </span>
        <h1 className="mt-4 text-4xl font-extrabold tracking-tight text-ink-900 sm:text-5xl">
          Show up with a gift
        </h1>
        <p className="mt-5 text-lg leading-relaxed text-ink-700">
          Every workshop we run starts with a box of supplies. Paint, seeds, spices, tools,
          fabric — whatever the lab calls for that day. When you send something from our
          wish list, it goes straight into a child's hands.
        </p>
        <p className="mt-3 text-lg leading-relaxed text-ink-700">
          No middleman. No storage fees. Just good stuff, put to good use.
        </p>
      </div>

      {/* Amazon Wish List CTA */}
      <div className="mt-12 rounded-3xl bg-primary-50 px-8 py-10 text-center shadow-sm ring-1 ring-primary-100">
        <p className="text-sm font-semibold uppercase tracking-widest text-primary-600">
          Amazon Wish List
        </p>
        <h2 className="mt-2 text-2xl font-extrabold text-ink-900">
          Our Workshop Wish List
        </h2>
        <p className="mt-3 text-base leading-relaxed text-ink-700">
          Shop directly from the items our workshops use most. Anything you send ships
          straight to us and gets put to work right away.
        </p>
        <a
          href="https://a.co/099AnZI7"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-6 inline-block rounded-full bg-primary-600 px-8 py-4 text-base font-bold text-white shadow-md transition hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
        >
          View our Workshop Wish List on Amazon
        </a>
        <p className="mt-4 text-xs text-ink-500">
          Opens in a new tab · Shipping goes directly to Links of Love Inc.
        </p>
      </div>

      {/* How it works */}
      <div className="mt-14">
        <h2 className="text-xl font-extrabold text-ink-900">How it works</h2>
        <p className="mt-3 text-base leading-relaxed text-ink-700">
          A donation funds the first batch of supplies. Kids come to a free workshop, make
          something real, and bring a sample home. The rest of what they make gets sold
          through our farmers market table, our website, and local partners. Those sales
          fund the next workshop at three to four times the volume.
        </p>
        <p className="mt-3 text-base leading-relaxed text-ink-700">
          The kids are the makers. The community is the customer. Your gift starts the
          whole thing.
        </p>
      </div>

      {/* Other ways to give */}
      <div className="mt-14 rounded-3xl bg-peach-100 px-8 py-8">
        <h2 className="text-xl font-extrabold text-ink-900">Other ways to give</h2>
        <p className="mt-3 text-base leading-relaxed text-ink-700">
          Want to donate supplies locally, sponsor a workshop, or give in another way?
          Reach out and we will figure it out together.
        </p>
        <a
          href="mailto:geovanna@linksofloveputnam.org"
          className="mt-5 inline-block rounded-full border border-ink-200 bg-white px-6 py-3 text-sm font-bold text-ink-900 transition hover:border-primary-300 hover:text-primary-700"
        >
          geovanna@linksofloveputnam.org
        </a>
      </div>

      {/* Footer note */}
      <p className="mt-10 text-center text-sm text-ink-500">
        Links of Love Inc. is a 501(c)(3) nonprofit · EIN 33-1608700 · Mahopac, NY
      </p>

    </div>
  )
}
