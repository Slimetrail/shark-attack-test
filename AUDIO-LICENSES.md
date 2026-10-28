# Audio licenses

## audio/title-cathedrale.ogg
- **Work:** Claude Debussy, *La Cathédrale engloutie* (the composition is public domain).
- **Performer and recording:** Ivan Ilić, recorded April 2006 in Paris.
- **License:** CC BY 3.0 Unported, https://creativecommons.org/licenses/by/3.0
  - Wikimedia permission (VRT) ticket #2019081610007057.
- **Source:** https://commons.wikimedia.org/wiki/File:La_Cath%C3%A9drale_engloutie_-_Claude_Debussy_-_performed_by_Ivan_Ilic.ogg
  - Original file sha1: 9b81c957e8668d704873dee00df9d7b87214bf55
- **Changes made:**
  - Trimmed to the first 88 s.
  - 1.5 s fade-in and a 4 s fade-out.
  - Converted to mono at 44.1 kHz, 64 kbps Vorbis.
  - Looped in game.
- **Attribution** is shown on the in-game Credits screen.

## audio/gameplay-chiptune.ogg
- **Work:** Claude Debussy, *Reflets dans l'eau*, from *Images, 1re série*. The score is public domain: it was published in 1905 and Debussy died in 1918.
- **Arrangement:** an original 8-bit chiptune arrangement by Slopcore Studio (the music team), transcribed by eye from the printed score only. **No recording of any kind was used**, so the track carries no recording license.
  - Made for Jeremy's personal-use project Shark Attack.
- **Score used:** first edition, Paris: A. Durand & Fils, 1905, plate D.&F. 6615.
  - Scan (Sibley Music Library, University of Rochester): https://urresearch.rochester.edu/fileDownloadForInstitutionalItem.action?itemId=18334&itemFileId=62230
  - IMSLP: https://imslp.org/wiki/Images,_1re_s%C3%A9rie_(Debussy,_Claude)
- **Where this text comes from:** the music team's CREDITS.txt, section "Gameplay track v2". Game Builder re-read it.
  - The v1 track and its CC BY-SA reference recording are **not** used or shipped.
  - The 8-bit title arrangement is not shipped either; the title keeps the Ivan Ilić recording above.
- **Link check by Game Builder, 27 Oct 2026, 5:10 PM EDT:**
  - The Rochester URL loads (HTTP 200, PDF, 25 pages, 2.4 MB, an EPSON scan from 2011). Its title page reads "Claude Debussy, Images, 1re Série pour Piano à 2 mains: I. Reflets dans l'eau, II. Hommage à Rameau, III. Mouvement, A. Durand & Fils".
  - The IMSLP page loads (HTTP 200). It lists the first edition (Paris: A. Durand, 1905, plate D.&F. 6615) as **Copyright: Public Domain**, and also a 1974 Dover reprint of it, likewise Public Domain.
  - IMSLP's scans of that edition come from other uploaders. It doesn't host the Rochester file itself, but it is the same edition and plate.
- **Changes made for the game:**
  - Converted from the delivered v2 WAV (72.0 s, mono, 44.1 kHz) to mono 64 kbps Ogg Vorbis, 511 KB. No trim and no edits: the music team's render already wraps the tail into the start to make a seamless loop.
  - Played as a gapless WebAudio loop at volume 0.3.

## Sound effects
All sound effects are synthesized at runtime in WebAudio and are original. No sample files are used.
