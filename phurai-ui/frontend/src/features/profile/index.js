export { default as ProfilePage } from "./pages/ProfilePage.jsx";
export { default as SettingsPage } from "./pages/SettingsPage.jsx";
export { default as ProfileDropdown } from "./components/ProfileDropdown.jsx";
export { default as AvatarPickerModal } from "./components/AvatarPickerModal.jsx";
export { default as AvatarPreviewModal } from "./components/AvatarPreviewModal.jsx";
export { default as AccountBackHome } from "./components/AccountBackHome.jsx";
export { default as PasswordAuthenticationPanel } from "./components/PasswordAuthenticationPanel.jsx";
export { default as OtpVerificationModal } from "./components/OtpVerificationModal.jsx";
export { default as StatusModal } from "./components/StatusModal.jsx";
export { default as AccountSwitchOverlay } from "./components/AccountSwitchOverlay.jsx";

export { useUserProfile, getStoredAuthUser } from "./hooks/useUserProfile.js";
export * from "./services/profileApi.js";
export * from "./utils/avatarUtils.js";
export * from "./components/accountIcons.jsx";
