ПОЛОЖИ СЮДА MP3-ФАЙЛЫ 2HOLLIS
================================

Каждый трек должен лежать в папке своего альбома с точным именем файла.
Имена формируются так: <номер>-<название> в нижнем регистре, пробелы -> "-".
Треклисты взяты из MusicBrainz (официальные релизы).

boy/
  01-you-once-said-my-name-for-the-first-time.mp3
  02-two-bad.mp3
  03-sister.mp3
  04-crush.mp3
  05-i-saw-it-flash-before-me.mp3
  06-say-it.mp3
  07-say-it-again.mp3
  08-teenage-soldier.mp3
  09-lie.mp3
  10-promise.mp3
  11-3.mp3
  12-light.mp3
  13-mountain.mp3

2/
  01-all-2s.mp3
  02-poster-boy.mp3
  03-god.mp3
  04-trust.mp3
  05-forfeit.mp3
  06-nothing2-lose.mp3
  07-blackbirds.mp3
  08-fame-runner.mp3
  09-2-u.mp3
  10-plaster.mp3
  11-it-will-never-be-the-same.mp3

white-tiger/
  01-gate.mp3
  02-king-of-the-darkness.mp3
  03-give-it-up.mp3
  04-i-do.mp3
  05-actor.mp3
  06-white-tiger.mp3
  07-the-light-upon-the-surface-that-beckoned-deep-into-the-moment-and-the-tiger-stepped-forth.mp3
  08-raise.mp3
  09-safety.mp3
  10-i-always-questioned-it.mp3

finally-lost/
  01-tiferet.mp3
  02-the-case-of-a-lost-2.mp3
  03-u-aint-on-it.mp3
  04-life-of-a-feeling.mp3
  05-zvq9r6r6qay-interlude.mp3
  06-talismans.mp3
  07-best-of-luck.mp3
  08-leeds.mp3
  09-nauseous.mp3

star/
  01-beginning.mp3
  02-flash.mp3
  03-cope.mp3
  04-you.mp3
  05-tell-me.mp3
  06-destroy-me.mp3
  07-burn.mp3
  08-girl.mp3
  09-dream-rain-sports.mp3
  10-nice.mp3
  11-nerve.mp3
  12-ego.mp3
  13-sidekick.mp3
  14-eldest-child.mp3
  15-safe.mp3

singles/
  01-jeans.mp3
  02-gold.mp3
  03-whiplash.mp3
  04-cliche.mp3
  05-4x4.mp3

Обложки лежат в ../covers/ (boy.jpg, 2.jpg, white-tiger.jpg, finally-lost.jpg,
star.jpg, crush.jpg, jeans.jpg, gold.jpg, whiplash.jpg).

Если хочешь другой набор треков или другие имена файлов -
отредактируй src/data/songs.ts (функция makeTrack).

После добавления файлов пересобери приложение:
  npm run build
  npx cap sync
