export const css = `
:host { all: initial; }
.bar { position: fixed; z-index: 2147483647; display: flex; gap: 6px; font: 600 14px/1 system-ui, sans-serif; }
.bar[hidden], .toast[hidden] { display: none; }
button { height: 44px; padding: 0 16px; border: 0; border-radius: 999px; cursor: pointer;
  font: inherit; box-shadow: 0 4px 14px rgba(42,36,51,.22); }
button:focus-visible { outline: 3px solid #C2571C; outline-offset: 2px; }
.crop { background: #F08A4B; color: #3B2A20; }
.keep { background: #3B2A20; color: #FFFFFF; }
.keep:disabled { opacity: .6; cursor: progress; }
.toast { position: fixed; z-index: 2147483647; right: 24px; bottom: 24px; max-width: 360px;
  padding: 14px 18px; border-radius: 18px; background: #3B2A20; color: #FFFFFF;
  font: 500 14px/1.4 system-ui, sans-serif; box-shadow: 0 12px 30px rgba(42,36,51,.3); }
`;
