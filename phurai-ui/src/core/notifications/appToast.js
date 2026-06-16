import toast from "react-hot-toast";
import React from "react";

export function appToastSuccess(message) {
  return toast.success(message);
}

export function appToastClickableSuccess(message, onClick) {
  return toast.success(
    React.createElement(
      "div",
      {
        onClick: () => {
          onClick();
          toast.dismiss();
        },
        style: { cursor: "pointer" }
      },
      message
    ),
    { duration: 5000 }
  );
}

export function appToastError(message) {
  return toast.error(message);
}

export function appToastInfo(message) {
  return toast(message);
}

export const APP_TOASTER_OPTIONS = {
  position: "top-right",
  toastOptions: {
    style: {
      background: "#1e1e1e",
      color: "#fff",
      border: "1px solid #bf9a63",
    },
    success: {
      iconTheme: {
        primary: "#bf9a63",
        secondary: "#1e1e1e",
      },
    },
    error: {
      iconTheme: {
        primary: "#e06c6c",
        secondary: "#1e1e1e",
      },
    },
  },
};
