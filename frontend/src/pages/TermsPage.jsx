import { Shield, ScrollText, AlertTriangle, Lock, Scale, Mail, Info } from "lucide-react";

export default function TermsPage() {
  const sections = [
    {
      title: "1. Acceptance of Terms",
      icon: Info,
      content: "By accessing and using the AgriTwin-MRV platform, you agree to be bound by these Terms and Conditions. This digital twin system is designed for agricultural monitoring and automation. If you do not agree with any part of these terms, you must discontinue use of the platform immediately.",
    },
    {
      title: "2. Service Description",
      icon: ScrollText,
      content: "AgriTwin-MRV provides real-time sensor monitoring, 3D visualization, automated irrigation controls, and AI-driven agronomic advice (TwinMind AI). The service is provided 'as is' and 'as available'. We reserve the right to modify or discontinue any feature without prior notice.",
    },
    {
      title: "3. AI Advisor (TwinMind AI)",
      icon: Shield,
      content: "The TwinMind AI assistant provides advice based on sensor data and agronomic models. While we strive for accuracy, AI-generated insights should be treated as expert suggestions rather than absolute commands. Users are responsible for verifying AI recommendations before taking actions that could affect crop health or hardware safety.",
    },
    {
      title: "4. Hardware & Automation Safety",
      icon: AlertTriangle,
      content: "The system allows for remote control of physical actuators (pumps, fans, etc.). Users acknowledge that hardware failure, network latency, or software bugs could lead to unexpected behavior. Emergency stop mechanisms are provided and should be tested regularly. We are not liable for any physical damage to crops or equipment resulting from automated or manual controls.",
    },
    {
      title: "5. Data Privacy & Security",
      icon: Lock,
      content: "Your greenhouse data is synced via Firebase and processed by Google Vertex AI. We implement industry-standard security measures, but no cloud-based system is 100% secure. By using the system, you consent to the collection and processing of your sensor data for the purpose of providing AI insights and historical analytics.",
    },
    {
      title: "6. Limitation of Liability",
      icon: Scale,
      content: "To the maximum extent permitted by law, AgriTwin-MRV and its developers shall not be liable for any indirect, incidental, or consequential damages, including but not limited to loss of profits, crop failure, or data loss, arising from the use or inability to use the platform.",
    },
    {
      title: "7. Contact & Support",
      icon: Mail,
      content: "For technical issues or inquiries regarding these terms, please contact the development team at support@agritwin.farm.",
    },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-fade-in pb-12">
      {/* Header */}
      <div className="text-center space-y-4">
        <div className="inline-flex items-center justify-center p-3 rounded-2xl bg-greenhouse-500/10 border border-greenhouse-500/20 text-greenhouse-400 mb-2">
          <ScrollText size={32} />
        </div>
        <h1 className="text-3xl font-bold text-white">Terms and Conditions</h1>
        <p className="text-gray-400 max-w-2xl mx-auto">
          Please read these terms carefully before using the AgriTwin-MRV Digital Twin platform. 
          Last updated: May 11, 2026.
        </p>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 gap-6">
        {sections.map((section, idx) => (
          <div 
            key={idx} 
            className="p-6 rounded-2xl bg-gray-900/50 border border-gray-800 hover:border-gray-700 transition-all group"
          >
            <div className="flex items-start gap-4">
              <div className="p-2 rounded-lg bg-gray-800 text-gray-400 group-hover:text-greenhouse-400 transition-colors shrink-0">
                <section.icon size={20} />
              </div>
              <div className="space-y-2">
                <h3 className="text-lg font-semibold text-white">{section.title}</h3>
                <p className="text-sm text-gray-400 leading-relaxed">
                  {section.content}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-greenhouse-600/10 to-blue-600/10 border border-greenhouse-500/20 text-center">
        <p className="text-xs text-gray-500 italic">
          &copy; 2026 AgriTwin Digital Twin Systems. All rights reserved. 
          Developed for advanced agentic agriculture research.
        </p>
      </div>
    </div>
  );
}
