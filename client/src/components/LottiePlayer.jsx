import React from 'react';
import Lottie from 'lottie-react';
import defaultAnimation from '../assets/animation.json';

export default function LottiePlayer({
  animationData = defaultAnimation,
  loop = true,
  autoplay = true,
  className = 'w-48 h-48 mx-auto',
  style,
}) {
  return (
    <div className={className} style={style}>
      <Lottie
        animationData={animationData}
        loop={loop}
        autoplay={autoplay}
        style={{ width: '100%', height: '100%' }}
      />
    </div>
  );
}
