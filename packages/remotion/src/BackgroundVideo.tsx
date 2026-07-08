import React from "react";
import { AbsoluteFill, Loop, OffthreadVideo, staticFile } from "remotion";

import type { BackgroundVideoContent } from "./types";

/**
 * Зацикленная gameplay-заливка позади переписки (Minecraft parkour,
 * Subway Surfers и т.п.) — держит внимание зрителя в TikTok/Reels.
 *
 * <OffthreadVideo> сам решает, как себя вести: внутри @remotion/player
 * (живое превью в браузере) он рендерится как обычный <video> —
 * быстро, без нагрузки; при серверном рендере — покадрово и точно.
 * Отдельная лёгкая копия для превью поэтому не нужна.
 *
 * <Loop> зацикливает видео по его РЕАЛЬНОЙ длительности (durationInFrames
 * из @remotion/media-parser), а не по подобранному на глаз числу.
 *
 * background.url — путь вида "/backgrounds/xxx.mp4", как его отдаёт Next.js
 * из apps/web/public. staticFile() пересчитывает его в правильный адрес и
 * для этого случая, и для собранного для рендера бандла Remotion (см. тот
 * же приём для логотипа подсказки в ChatVideo.tsx).
 *
 * trimBeforeFrames — стандартный механизм обрезки Remotion (проп trimBefore
 * у OffthreadVideo, бывший startFrom), не ручной пересчёт кадров. Каждая
 * итерация <Loop> начинает воспроизведение заново с этой точки, поэтому
 * durationInFrames здесь — длительность именно выбранного фрагмента:
 * зацикливается фрагмент, а не весь файл.
 */
export const BackgroundVideo: React.FC<{
  background: BackgroundVideoContent;
}> = ({ background }) => {
  return (
    <AbsoluteFill>
      <Loop durationInFrames={background.durationInFrames}>
        <OffthreadVideo
          src={staticFile(background.url)}
          volume={background.volume}
          trimBefore={background.trimBeforeFrames}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      </Loop>
      <AbsoluteFill
        style={{ background: `rgba(0, 0, 0, ${background.overlayOpacity})` }}
      />
    </AbsoluteFill>
  );
};
