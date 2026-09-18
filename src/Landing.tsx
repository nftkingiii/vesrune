import { ArrowRight, Check, Leaf, ShieldCheck } from 'lucide-react';
import './landing.css';

export default function Landing() {
  return <div className="landing">
    <a className="landing-skip" href="#landing-content">Skip to content</a>
    <header className="landing-nav">
      <a className="landing-brand" href="/" aria-label="Vesrune home"><img src="/mark.svg" width="34" height="34" alt=""/>vesrune</a>
      <span className="landing-nav-note">A little yield. A lot of possibility.</span>
      <a className="landing-entry" href="#overview">Open app <ArrowRight size={16}/></a>
    </header>
    <main id="landing-content" className="landing-main">
      <section className="landing-hero">
        <div className="landing-copy">
          <h1>Let your yield<br/>do the <span>work.</span></h1>
          <p>An account for putting realized earnings to use.<br className="landing-break"/> Fund the tasks you approve. Keep capital separate.</p>
          <a href="#overview" className="landing-cta">Explore Vesrune <ArrowRight size={19}/></a>
          <div className="landing-demo"><span/>Explore the testnet demo</div>
        </div>
        <div className="landing-scene" role="img" aria-label="Illustration of capital held separately, with realized earnings flowing into an approved work budget">
          <div className="landing-halo"/>
          <div className="landing-orbit landing-orbit-one"/><div className="landing-orbit landing-orbit-two"/>
          <div className="landing-vault"><div className="landing-vault-top"><img src="/mark.svg" alt=""/><span>THE WORK ACCOUNT</span></div><div className="landing-vault-title">Room to grow.</div><div className="landing-vault-base"><ShieldCheck size={16}/><span>Capital stays separate</span></div></div>
          <div className="landing-flow-line"/>
          <div className="landing-yield"><span className="landing-yield-icon"><Leaf size={19}/></span><div><small>REALIZED EARNINGS</small><strong>Your next work budget</strong></div></div>
          <div className="landing-task"><span className="landing-task-check"><Check size={16}/></span><span>Research. Translate. Create.</span><small>You approve.</small></div>
          <span className="landing-scene-caption">THE IDEA, ILLUSTRATED</span>
        </div>
      </section>
      <section className="landing-bottom" aria-label="How Vesrune works">
        <div className="landing-bottom-intro"><span>MORE POSSIBILITY.<br/>SAME PRINCIPLE.</span><h2>Your capital has a job.<br/>Your earnings can, too.</h2></div>
        <div className="landing-step"><span>01</span><h3>Grow</h3><p>Explore earn opportunities through Pollar.</p></div>
        <div className="landing-step"><span>02</span><h3>Set aside</h3><p>Turn realized earnings into a budget for work.</p></div>
        <div className="landing-step"><span>03</span><h3>Make it happen</h3><p>Approve a task. Review the result. Release payment.</p></div>
      </section>
    </main>
    <footer className="landing-footer"><span>Built with Pollar · On Stellar testnet</span><span>Yield & work preview · Local funding sandbox</span><a href="#routes">Explore Local Routes <ArrowRight size={14}/></a></footer>
  </div>;
}
