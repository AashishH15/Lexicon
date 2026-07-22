import OnboardingModal from "./OnboardingModal.jsx";

export default function AiSetupModal({ onClose, onConfigured, onFinish }) {
  return (
    <OnboardingModal
      onClose={onClose}
      onConfigured={onConfigured}
      onFinish={onFinish}
    />
  );
}
