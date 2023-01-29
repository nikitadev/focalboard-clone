import React, { useState, useEffect } from "react";
import { createNanoEvents } from "nanoevents";

const nanoevent = createNanoEvents();

export function sendFlashMessage(msg) {
  nanoevent.emit("message", msg);
}

export const FlashMessages = React.memo((props) => {
  const [message, setMessage] = useState(null);
  const [fadeOut, setFadeOut] = useState(false);
  const [timeoutId, setTimeoutId] = useState(null);

  useEffect(() => {
    let subs = true;
    nanoevent.on("message", function (msg) {
      if (subs) {
        if (timeoutId) {
          clearTimeout(timeoutId);
          setTimeoutId(null);
        }
        setTimeoutId(setTimeout(handleFadeOut, props.milliseconds - 200));
        setMessage(msg);
      }
    });
    return () => {
      subs = false;
    };
  }, []);

  const handleFadeOut = function () {
    setFadeOut(true);
    setTimeoutId(setTimeout(handleTimeout, 200));
  };

  const handleTimeout = () => {
    setMessage(null);
    setFadeOut(false);
  };

  const handleClick = function () {
    if (timeoutId) {
      clearTimeout(timeoutId);
      setTimeoutId(null);
    }
    handleFadeOut();
  };

  if (!message) {
    return null;
  }

  return (
    <div
      className={`FlashMessages ${message.severity} ${
        fadeOut ? " flashOut" : " flashIn"
      }`}
      onClick={handleClick}
    >
      {message.content}
    </div>
  );
});
