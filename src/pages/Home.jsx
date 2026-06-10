import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useDynamicStyleSheet } from '../hooks/useDynamicStyleSheet.jsx';

const quotes = [
  {
    text: 'Education is the most powerful weapon which you can use to change the world.',
    author: 'Nelson Mandela'
  },
  {
    text: 'The future belongs to those who learn more skills and combine them in creative ways.',
    author: 'Robert Greene'
  },
  {
    text: 'Your skills are the only capital that will never fail you.',
    author: 'Skill Street Philosophy'
  },
  {
    text: 'Bridge the gap between potential and performance.',
    author: 'Mission Statement'
  },
  {
    text: 'Learning is a treasure that will follow its owner everywhere.',
    author: 'Chinese Proverb'
  }
];

export default function Home() {
  useDynamicStyleSheet('/home.css');
  const location = useLocation();
  const [quoteIndex, setQuoteIndex] = useState(0);

  useEffect(() => {
    const target = location.state?.scrollTo || location.hash.replace('#', '');
    if (target) {
      const section = document.getElementById(target);
      if (section) {
        section.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [location]);

  useEffect(() => {
    const interval = setInterval(() => {
      setQuoteIndex((current) => (current + 1) % quotes.length);
    }, 6000);
    return () => clearInterval(interval);
  }, []);

  const quote = quotes[quoteIndex];

  return (
    <main id="home-page" className="page-content active w-full">
      <section className="relative flex min-h-[100vh] items-center bg-gradient-to-b from-blue-900 via-blue-950 to-black px-4 sm:px-6 pb-20 pt-32">
        <div className="hero-blob"></div>
        <div className="relative z-10 mx-auto mt-10 max-w-7xl text-center">
          <span className="inline-block rounded-full border border-orange-500/30 bg-orange-500/10 px-4 py-1 text-xs font-bold uppercase tracking-widest text-orange-300 mb-6">
            The Frontier of Learning
          </span>
          <h1 className="mb-8 text-5xl font-extrabold leading-tight md:text-7xl">
            The Street Where Skills<br />
            <span className="gradient-text hero-highlight">Meet Opportunity.</span>
          </h1>
          <p className="mx-auto mb-10 max-w-2xl text-lg leading-relaxed text-slate-300 md:text-xl">
            Build real skills, work on real projects, and unlock opportunities — before graduation
          </p>

          <div className="flex flex-col items-center justify-center space-y-4 md:flex-row md:space-x-4 md:space-y-0">
            <button
              type="button"
              onClick={() => window.open('https://www.linkedin.com/company/skill.street/', '_blank')}
              className="btn-glass-white flex w-full items-center justify-center rounded-xl px-8 py-4 font-bold md:w-auto"
            >
              Explore Skills <i className="fas fa-arrow-right ml-2 text-sm"></i>
            </button>
            <button
              type="button"
              onClick={() => {
                const about = document.getElementById('about');
                if (about) about.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }}
              className="btn-glass w-full rounded-xl px-8 py-4 font-bold text-white md:w-auto"
            >
              Our Mission
            </button>
          </div>
        </div>
      </section>

      <section id="about" className="py-24 px-4 sm:px-6 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row items-center gap-16">
            <div className="flex-1">
              <h2 className="text-4xl font-bold mb-6"><span className="section-heading-dark">Redefining Your</span> <br /><span className="accent-text">Learning Path</span></h2>
              <p className="mb-8 text-lg font-semibold text-slate-800">Skill Street isn't just an education platform; it's an immersive career ecosystem designed to inspire, inform, and innovate.</p>

              <ul className="space-y-6">
                <li className="flex items-start space-x-4">
                  <div className="mt-1 rounded-xl bg-blue-950 p-2"><i className="fas fa-infinity text-sm accent-icon"></i></div>
                  <div>
                    <span className="block text-lg font-bold text-blue-950">Lifetime Access</span>
                    <span className="text-sm font-semibold text-slate-600">Gain permanent access to our exclusive vault of community resources, toolkits, and tournaments once you join.</span>
                  </div>
                </li>
                <li className="flex items-start space-x-4">
                  <div className="mt-1 rounded-xl bg-blue-950 p-2"><i className="fas fa-vr-cardboard text-sm accent-icon"></i></div>
                  <div>
                    <span className="block text-lg font-bold text-blue-950">Skill-First Learning</span>
                    <span className="text-sm font-semibold text-slate-600">Learn beyond academic definitions. Our curriculum focuses on "how to perform" in real-world scenarios.</span>
                  </div>
                </li>
                <li className="flex items-start space-x-4">
                  <div className="mt-1 rounded-xl bg-blue-950 p-2"><i className="fas fa-users text-sm accent-icon"></i></div>
                  <div>
                    <span className="block text-lg font-bold text-blue-950">Learn From Real life Projects</span>
                    <span className="text-sm font-semibold text-slate-600">Compete globally for various tasks from different founders and earn exciting oppurtunities .</span>
                  </div>
                </li>
              </ul>
            </div>
            <div className="flex-1 relative">
              <div className="w-full aspect-square glass rounded-3xl overflow-hidden animate-float">
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/20 to-purple-500/20"></div>
                <img src="/about%20sec%20.jpeg" alt="Learning" className="w-full h-full object-cover mix-blend-overlay" />
              </div>
            </div>
          </div>
        </div>
      </section>

<section id="founders-story" className="relative overflow-hidden py-24 px-4 sm:px-6 bg-blue-950 text-white">
        <div className="absolute inset-0 opacity-30 pointer-events-none">
          <div className="absolute -top-40 -left-40 w-[40rem] h-[40rem] rounded-full bg-gradient-to-br from-orange-500/20 via-purple-500/10 to-blue-500/0 blur-3xl" />
          <div className="absolute top-20 -right-48 w-[35rem] h-[35rem] rounded-full bg-gradient-to-br from-blue-500/20 via-cyan-500/10 to-indigo-500/0 blur-3xl" />
        </div>
        <div className="relative max-w-7xl mx-auto">
          <div className="text-center mb-16 px-2">
            <span className="inline-block py-1 px-4 rounded-full border border-orange-500/30 bg-orange-500/10 text-orange-300 text-xs font-bold uppercase tracking-widest mb-6">
              Founders Story
            </span>
            <h2 className="text-4xl md:text-5xl font-bold mb-6">Built From a Shared Belief That Learning Should Lead Somewhere Real</h2>
            <p className="text-slate-300 text-lg leading-relaxed w-full">
              SkillStreet started with a simple frustration.
              Students were learning, completing courses, and collecting certificates 
              but when it came to real opportunities, most were still stuck.

              Coming from a non-traditional path myself, I saw talented students being overlooked 
              not because they lacked ability,
              but because they lacked access.

              So we decided to change that.
              Not with another course.
              Not with another promise.
              With real opportunities.

              That decision became SkillStreet.
            </p>
          </div>

          <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
            <div className="space-y-6">
              <div className="p-8 rounded-[2rem] bg-white/5 border border-white/10 backdrop-blur-sm shadow-[0_18px_60px_rgba(0,0,0,0.35)] hover:shadow-[0_22px_80px_rgba(0,0,0,0.45)] transition-shadow duration-300">
                <h3 className="text-2xl font-bold mb-4 text-orange-400">How It Started</h3>

                <p className="text-slate-300 leading-relaxed mb-4">
                  What began as small experiments connecting a few students with startups quickly turned into a mission.
                </p>
                <p className="text-slate-300 leading-relaxed">
                  We saw confidence grow the moment students worked on real problems. That's when we realized the gap wasn't in talent. The gap was in opportunity.
                </p>
              </div>

              <div className="p-8 rounded-[2rem] bg-orange-500/10 border border-orange-400/20 shadow-[0_18px_60px_rgba(0,0,0,0.35)] hover:shadow-[0_22px_80px_rgba(0,0,0,0.45)] transition-shadow duration-300">
                <h3 className="text-2xl font-bold mb-4 text-white">What We Wanted To Change</h3>
                <p className="text-slate-200 leading-relaxed">
                  We wanted to fix one broken experience: internships. Too many students faced unclear roles, unpaid work, and broken promises. SkillStreet was built to bring clarity, accountability, and real-world execution into internships.
                </p>
              </div>
            </div>

            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-1">
              <div className="p-6 rounded-3xl bg-blue-900/60 border border-blue-800/60 shadow-[0_18px_60px_rgba(0,0,0,0.35)] hover:shadow-[0_22px_80px_rgba(0,0,0,0.45)] transition-shadow duration-300">
                <h4 className="text-xl font-bold mb-3 text-white">Vision</h4>

                <p className="text-slate-300 text-sm leading-relaxed">Make real opportunities accessible to every student regardless of background.</p>
              </div>
              <div className="p-6 rounded-3xl bg-blue-900/60 border border-blue-800/60 shadow-[0_18px_60px_rgba(0,0,0,0.35)] hover:shadow-[0_22px_80px_rgba(0,0,0,0.45)] transition-shadow duration-300">
                <h4 className="text-xl font-bold mb-3 text-white">Struggle</h4>

                <p className="text-slate-300 text-sm leading-relaxed">No funding. No shortcuts. Just belief and relentless execution.</p>
              </div>
              <div className="p-6 rounded-3xl bg-blue-900/60 border border-blue-800/60 sm:col-span-2 lg:col-span-1 shadow-[0_18px_60px_rgba(0,0,0,0.35)] hover:shadow-[0_22px_80px_rgba(0,0,0,0.45)] transition-shadow duration-300">
                <h4 className="text-xl font-bold mb-3 text-white">Outcome</h4>

                <p className="text-slate-300 text-sm leading-relaxed">Today, SkillStreet is building a system where learning leads to action, and action leads to careers. And this is only the beginning.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="why" className="py-24 text-center bg-white border-y border-zinc-900 px-4 sm:px-6">
        <h2 className="mb-16 text-4xl font-bold text-blue-950">Why <span className="accent-text">SkillStreet?</span></h2>
          <div className="grid md:grid-cols-3 gap-12 max-w-5xl mx-auto">
        <div className="p-8 rounded-2xl border border-white/5 bg-blue-900 shadow-[0_18px_60px_rgba(0,0,0,0.15)] hover:shadow-[0_22px_80px_rgba(0,0,0,0.35)] hover:border-indigo-500/30 transition-all hover:bg-blue-800">
            <div className="w-12 h-12 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-6 text-xl">
              <i className="fas fa-bolt accent-icon"></i>
            </div>
            <h3 className="text-white text-xl font-bold mb-3">Real Skills</h3>
            <p className="text-white text-sm leading-relaxed">No theory. Only practical execution. We focus on results that matter in the real world.</p>
          </div>
          <div className="p-8 rounded-2xl border border-white/5 hover:border-purple-500/30 transition-all bg-blue-900 shadow-[0_18px_60px_rgba(0,0,0,0.15)] hover:shadow-[0_22px_80px_rgba(0,0,0,0.35)] hover:bg-blue-800">
            <div className="w-12 h-12 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-6 text-xl">
              <i className="fas fa-graduation-cap accent-icon"></i>
            </div>
            <h3 className="text-white text-xl font-bold mb-3">Student Friendly</h3>
            <p className="text-white text-sm leading-relaxed">Built for learners, not just professionals. Simple, accessible, and high impact.</p>
          </div>
          <div className="p-8 rounded-2xl border border-white/5 hover:border-cyan-500/30 transition-all bg-blue-900  shadow-[0_18px_60px_rgba(0,0,0,0.15)] hover:shadow-[0_22px_80px_rgba(0,0,0,0.35)] hover:bg-blue-800">
            <div className="w-12 h-12 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-6 text-xl">
              <i className="fas fa-rocket accent-icon"></i>
            </div>
            <h3 className="text-white text-xl font-bold mb-3">Future Ready</h3>
            <p className="text-white text-sm leading-relaxed">Skills that actually matter in 2026. Stay ahead of the curve with emerging tech mastery.</p>
          </div>
        </div>
      </section>

      <section id="founders" className="relative overflow-hidden py-24 px-4 sm:px-6 bg-white">
        <div className="max-w-7xl mx-auto text-center">
          <h2 className="mb-4 text-4xl font-bold text-blue-900">The Minds Behind <span className="accent-text">Skill Street</span></h2>
          <p className="max-w-xl mx-auto mb-16 text-slate-600">Visionaries dedicated to bridging the global skills gap.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-3xl mx-auto">
            <div className="p-8 rounded-[2rem] text-center transition-all duration-300 hover:bg-blue-800 hover:border-orange-400/40 border border-blue-900/30 bg-blue-900">
              <div className="w-24 h-24 mx-auto mb-6 rounded-full overflow-hidden border-2 border-indigo-500/30">
                <img src="https://ui-avatars.com/api/?name=Hanu+Pandey&background=3b82f6&color=fff&size=128" alt="Hanu Pandey" className="w-full h-full object-cover" />
              </div>
              <h3 className="text-xl font-semibold mb-1">Hanu Pandey</h3>
              <p className="text-orange-300 text-xs font-medium mb-4 uppercase tracking-wider">Founder</p>
              <a href="https://www.linkedin.com/in/hanu-pandey-827b05312" target="_blank" rel="noreferrer" className="inline-flex items-center justify-center px-6 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-full text-sm font-bold transition-all">
                LinkedIn <i className="fab fa-linkedin ml-2"></i>
              </a>
            </div>
            <div className="p-8 rounded-[2rem] text-center transition-all duration-300 hover:bg-blue-800 hover:border-orange-400/40 border border-blue-900/30 bg-blue-900">
              <div className="w-24 h-24 mx-auto mb-6 rounded-full overflow-hidden border-2 border-purple-500/30">
                <img src="https://ui-avatars.com/api/?name=Ganesh+Mishra&background=a855f7&color=fff&size=128" alt="Ganesh Mishra" className="w-full h-full object-cover" />
              </div>
              <h3 className="text-xl font-semibold mb-1">Ganesh Mishra</h3>
              <p className="text-orange-300 text-xs font-weight-600 mb-4 uppercase tracking-wider">Co-Founder</p>
              <a href="https://www.linkedin.com/in/ganesh-mishra-287546246" target="_blank" rel="noreferrer" className="inline-flex items-center justify-center px-6 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-full text-sm font-bold transition-all">
                LinkedIn <i className="fab fa-linkedin ml-2"></i>
              </a>
            </div>
          </div>
        </div>
      </section>

      <section className="quote-section">
        <div id="quote-box">
          <p id="quote-text">"{quote.text}"</p>
          <span id="quote-author">{quote.author}</span>
        </div>
      </section>
    </main>
  );
}
