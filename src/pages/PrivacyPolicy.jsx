import { Link } from 'react-router-dom';
import { useEffect } from 'react';
import { useDynamicStyleSheet } from '../hooks/useDynamicStyleSheet.jsx';

export default function PrivacyPolicy() {
  useDynamicStyleSheet('/home.css');

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, []);

  return (
    <div id="privacy-page" className="page-content">
      <section className="bg-black text-zinc-300 px-6 py-32 min-h-screen">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl md:text-5xl text-white font-light mb-8">Privacy Policy & Terms and Conditions</h1>
          <p className="mb-6 text-sm text-slate-400">Last Updated: June 4, 2026</p>

          <h2 className="text-xl text-white mt-10 mb-4 font-bold">Privacy Policy</h2>
          <p className="mb-6 leading-relaxed text-lg">
            SkillStreet values your privacy and is committed to protecting your personal information. This Privacy Policy explains how we collect, use, and safeguard information when you use the SkillStreet platform.
          </p>

          <h3 className="text-lg text-white mt-8 mb-3 font-semibold">Information We Collect</h3>
          <p className="leading-relaxed mb-6">
            SkillStreet may collect personal information such as your name, email address, phone number, education details, skills, and profile information when you register or interact with the platform. Startups using the platform may also provide company details and problem statements related to their challenges.
          </p>

          <h3 className="text-lg text-white mt-8 mb-3 font-semibold">How We Use Your Information</h3>
          <p className="leading-relaxed mb-6">
            The information collected is used to operate and improve the platform, enable interactions between students and startups, match users with relevant opportunities, provide support services, and ensure the security and functionality of the website.
          </p>

          <h3 className="text-lg text-white mt-8 mb-3 font-semibold">Data Sharing</h3>
          <p className="leading-relaxed mb-6">
            SkillStreet does not sell personal information. However, user profiles and submitted solutions may be shared with startups when students participate in challenges. We may also use trusted third-party services such as hosting providers, analytics tools, and payment processors to operate the platform.
          </p>

          <h3 className="text-lg text-white mt-8 mb-3 font-semibold">Data Security</h3>
          <p className="leading-relaxed mb-6">
            Reasonable technical and organizational measures are implemented to protect user information. However, SkillStreet cannot guarantee complete security of information transmitted over the internet.
          </p>

          <h3 className="text-lg text-white mt-8 mb-3 font-semibold">Your Rights</h3>
          <p className="leading-relaxed mb-6">
            Users may request access, correction, or deletion of their personal data where applicable. SkillStreet reserves the right to update this Privacy Policy at any time, and continued use of the platform indicates acceptance of the updated policy.
          </p>

          <h2 className="text-xl text-white mt-12 mb-4 font-bold">Terms and Conditions</h2>
          <p className="mb-6 leading-relaxed text-lg">
            These Terms and Conditions govern the use of the SkillStreet platform. By accessing or using the platform, users agree to comply with these terms.
          </p>

          <h3 className="text-lg text-white mt-8 mb-3 font-semibold">Platform Purpose</h3>
          <p className="leading-relaxed mb-6">
            SkillStreet provides a digital platform where startups can publish real business challenges and students can attempt to solve them in order to gain practical experience and skill-based opportunities. SkillStreet does not guarantee internships, employment, or selection in any challenge.
          </p>

          <h3 className="text-lg text-white mt-8 mb-3 font-semibold">User Responsibilities</h3>
          <p className="leading-relaxed mb-6">
            Users are responsible for maintaining accurate account information and protecting their login credentials. SkillStreet reserves the right to suspend or terminate accounts that violate platform policies or engage in misuse of the service.
          </p>

          <h3 className="text-lg text-white mt-8 mb-3 font-semibold">Content Guidelines</h3>
          <p className="leading-relaxed mb-6">
            Students submitting solutions confirm that their work is original and does not violate any intellectual property rights. Startups posting challenges must ensure that their problem statements comply with applicable laws and do not contain confidential or unlawful material.
          </p>

          <h3 className="text-lg text-white mt-8 mb-3 font-semibold">Payments and Fees</h3>
          <p className="leading-relaxed mb-6">
            Any stipend or payment offered for challenges is the responsibility of the startup offering the opportunity. SkillStreet may charge a service fee or commission for facilitating connections through the platform.
          </p>

          <h3 className="text-lg text-white mt-8 mb-3 font-semibold">Intellectual Property</h3>
          <p className="leading-relaxed mb-6">
            All website content, design, branding, and technology belong to SkillStreet and may not be copied or distributed without permission.
          </p>

          <h3 className="text-lg text-white mt-8 mb-3 font-semibold">Limitation of Liability</h3>
          <p className="leading-relaxed mb-6">
            SkillStreet acts only as an intermediary between students and startups and is not responsible for outcomes, disputes, or decisions made by either party.
          </p>

          <h3 className="text-lg text-white mt-8 mb-3 font-semibold">Governing Law</h3>
          <p className="leading-relaxed mb-6">
            These Terms are governed by the laws of India, and any disputes shall be subject to the jurisdiction of courts in Delhi.
          </p>

          <h3 className="text-lg text-white mt-8 mb-3 font-semibold">Contact</h3>
          <div className="mt-4 space-y-4 mb-10">
            <p className="text-orange-300">
              Email: Support.skillstreet@gmail.com
            </p>
            <a href="https://skillstreet.carrd.co/" target="_blank" rel="noreferrer" className="block text-orange-300 hover:text-white transition-colors underline">
              Website: skillstreet.carrd.co
            </a>
            <a href="https://www.linkedin.com/company/skill.street/" target="_blank" rel="noreferrer" className="block text-orange-300 hover:text-white transition-colors underline">
              LinkedIn: SkillStreet
            </a>
          </div>

          <p className="text-xs text-slate-500 mb-8">
            By using SkillStreet, you agree to the terms outlined in this Privacy Policy and Terms and Conditions.
          </p>

          <Link to="/" className="btn-glass px-8 py-3 rounded-xl text-white">Back to Home</Link>
        </div>
      </section>
    </div>
  );
}
