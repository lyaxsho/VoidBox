import React, { useState } from 'react';

const PoliciesPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'privacy' | 'terms'>('privacy');

  return (
    <div className="min-h-screen p-6 md:p-12">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-light text-gray-900 dark:text-white mb-8" style={{ fontFamily: 'Georgia, serif' }}>
          Legal Information
        </h1>

        {/* Tabs */}
        <div className="flex bg-gray-100 dark:bg-gray-900 rounded-xl p-1 mb-8 w-fit">
          <button
            onClick={() => setActiveTab('privacy')}
            className={`px-6 py-3 rounded-lg font-medium transition-colors ${
              activeTab === 'privacy' 
                ? 'bg-white text-black' 
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Privacy Policy
          </button>
          <button
            onClick={() => setActiveTab('terms')}
            className={`px-6 py-3 rounded-lg font-medium transition-colors ${
              activeTab === 'terms' 
                ? 'bg-white text-black' 
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Terms of Use
          </button>
        </div>

        {activeTab === 'privacy' ? (
          <div className="text-gray-700 dark:text-gray-300 space-y-6">
            <section>
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">Privacy Policy</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">Last updated: January 2025</p>
              
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">1. Information We Collect</h3>
              <p className="mb-4">
                VoidBox is designed with privacy as a fundamental principle. We collect minimal information necessary to provide our service:
              </p>
              <ul className="list-disc list-inside space-y-2 mb-6">
                <li>Files and content you voluntarily upload to our service</li>
                <li>Basic usage analytics to improve service performance</li>
                <li>Technical information such as IP addresses and browser types for security purposes</li>
              </ul>

              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">2. How We Use Your Information</h3>
              <p className="mb-4">Your data is used exclusively for:</p>
              <ul className="list-disc list-inside space-y-2 mb-6">
                <li>Providing file storage and retrieval services</li>
                <li>Maintaining service security and preventing abuse</li>
                <li>Improving our service based on aggregate usage patterns</li>
              </ul>

              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">3. Data Storage and Security</h3>
              <p className="mb-4">
                Your files are stored securely using industry-standard encryption. We utilize Telegram's infrastructure 
                for reliable and secure data transmission and storage. Your content is encrypted both in transit and at rest.
              </p>

              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">4. Data Sharing</h3>
              <p className="mb-4">
                We do not sell, trade, or otherwise transfer your personal information to third parties. Your files 
                remain private and are accessible only to you unless you explicitly choose to share them.
              </p>

              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">5. Data Retention</h3>
              <p className="mb-4">
                Your files are stored permanently unless you choose to delete them. You have full control over your 
                data and can delete any file at any time through the VoidBox interface.
              </p>

              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">6. Your Rights</h3>
              <p className="mb-4">You have the right to:</p>
              <ul className="list-disc list-inside space-y-2 mb-6">
                <li>Access all data we have about you</li>
                <li>Delete your data at any time</li>
                <li>Export your data in a standard format</li>
                <li>Request corrections to any inaccurate information</li>
              </ul>

              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">7. Contact Us</h3>
              <p>
                If you have any questions about this Privacy Policy, please contact us through our support channels.
              </p>
            </section>
          </div>
        ) : (
          <div className="text-gray-700 dark:text-gray-300 space-y-6">
            <section>
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">Terms of Use</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">Last updated: January 2025</p>
              
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">1. Acceptance of Terms</h3>
              <p className="mb-6">
                By accessing and using VoidBox, you accept and agree to be bound by the terms and provision of this agreement.
              </p>

              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">2. Use License</h3>
              <p className="mb-4">
                Permission is granted to temporarily use VoidBox for personal, non-commercial transitory viewing only. 
                This is the grant of a license, not a transfer of title, and under this license you may not:
              </p>
              <ul className="list-disc list-inside space-y-2 mb-6">
                <li>Modify or copy the materials</li>
                <li>Use the materials for any commercial purpose or for any public display</li>
                <li>Attempt to reverse engineer any software contained on the website</li>
                <li>Remove any copyright or other proprietary notations from the materials</li>
              </ul>

              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">3. Acceptable Use</h3>
              <p className="mb-4">You agree not to use VoidBox to:</p>
              <ul className="list-disc list-inside space-y-2 mb-6">
                <li>Upload, store, or share content that is illegal, harmful, or violates others' rights</li>
                <li>Distribute malware, viruses, or other malicious software</li>
                <li>Engage in any activity that disrupts or interferes with the service</li>
                <li>Attempt to gain unauthorized access to our systems or other users' accounts</li>
              </ul>

              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">4. Service Availability</h3>
              <p className="mb-6">
                We strive to maintain high service availability but cannot guarantee uninterrupted service. 
                We reserve the right to modify, suspend, or discontinue the service at any time.
              </p>

              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">5. Limitation of Liability</h3>
              <p className="mb-6">
                VoidBox shall not be liable for any damages arising from the use or inability to use the service, 
                including but not limited to loss of data, business interruption, or other commercial damages.
              </p>

              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">6. Modifications</h3>
              <p className="mb-6">
                We reserve the right to revise these terms at any time without notice. By using this service, 
                you agree to be bound by the current version of these terms.
              </p>

              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">7. Governing Law</h3>
              <p>
                These terms and conditions are governed by and construed in accordance with applicable laws, 
                and you irrevocably submit to the exclusive jurisdiction of the courts in that state or location.
              </p>
            </section>
          </div>
        )}
      </div>
    </div>
  );
};

export default PoliciesPage;