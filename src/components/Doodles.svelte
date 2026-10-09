<script lang="ts">
  // Decorative only: no props.
</script>

<!-- A soft, slowly drifting wallpaper of hand-drawn doodles (same set as the kudoodle website). -->
<svg class="doodles" aria-hidden="true">
  <defs>
    <symbol id="kd-sun" viewBox="0 0 100 100"><g fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round"><circle cx="50" cy="50" r="17"/><path d="M50 12v12M50 76v12M12 50h12M76 50h12M23 23l8 8M69 69l8 8M77 23l-8 8M31 69l-8 8"/></g></symbol>
    <symbol id="kd-flower" viewBox="0 0 100 100"><g fill="none" stroke="currentColor" stroke-width="5"><circle cx="50" cy="28" r="14"/><circle cx="72" cy="46" r="14"/><circle cx="63" cy="72" r="14"/><circle cx="37" cy="72" r="14"/><circle cx="28" cy="46" r="14"/></g></symbol>
    <symbol id="kd-cat" viewBox="0 0 100 100"><g fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round"><path d="M20 55c0-22 14-36 30-36s30 14 30 36-14 28-30 28-30-6-30-28z"/><path d="M30 24l-6-12 14 6M70 24l6-12-14 6"/><path d="M44 63c4 4 8 4 12 0"/></g></symbol>
    <symbol id="kd-leaf" viewBox="0 0 100 100"><g fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"><path d="M25 78C25 40 50 20 80 20c0 32-22 58-55 58z"/><path d="M25 78L62 38"/></g></symbol>
    <symbol id="kd-heart" viewBox="0 0 100 100"><path d="M50 80S18 60 18 38a16 16 0 0 1 32-6 16 16 0 0 1 32 6c0 22-32 42-32 42z" fill="none" stroke="currentColor" stroke-width="5" stroke-linejoin="round"/></symbol>
    <symbol id="kd-star" viewBox="0 0 100 100"><path d="M50 14l10 24 26 2-20 17 7 25-23-14-23 14 7-25-20-17 26-2z" fill="none" stroke="currentColor" stroke-width="5" stroke-linejoin="round"/></symbol>
    <symbol id="kd-cloud" viewBox="0 0 100 100"><path d="M30 70h42a14 14 0 0 0 0-28 20 20 0 0 0-38-4 14 14 0 0 0-4 32z" fill="none" stroke="currentColor" stroke-width="5" stroke-linejoin="round"/></symbol>
    <symbol id="kd-wave" viewBox="0 0 100 100"><path d="M6 55c10-30 20-30 26 0s18 30 26 0 18-30 26 0" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round"/></symbol>
    <pattern id="kd-pattern" width="320" height="320" patternUnits="userSpaceOnUse">
      <g color="#3B2A20" opacity=".09">
        <use href="#kd-star" x="10" y="16" width="44" height="44"/>
        <use href="#kd-wave" x="120" y="8" width="70" height="70"/>
        <use href="#kd-flower" x="236" y="30" width="56" height="56"/>
        <use href="#kd-heart" x="150" y="118" width="46" height="46"/>
        <use href="#kd-cloud" x="236" y="140" width="66" height="66"/>
        <use href="#kd-sun" x="12" y="232" width="58" height="58"/>
        <use href="#kd-cat" x="120" y="222" width="60" height="60"/>
        <use href="#kd-leaf" x="40" y="120" width="52" height="52"/>
      </g>
    </pattern>
  </defs>
  <rect width="100%" height="100%" fill="url(#kd-pattern)" />
</svg>

<style>
  .doodles { position: fixed; inset: -320px; width: calc(100% + 640px); height: calc(100% + 640px); z-index: 0; pointer-events: none; animation: drift 120s linear infinite; }
  @keyframes drift { to { transform: translate(320px, 320px); } }
  @media (prefers-reduced-motion: reduce) { .doodles { animation: none; } }
</style>
