/**
 * Procedural PBR reflection environment. No downloaded HDR files or network calls.
 * The environment only affects physically based materials, not pin raycasting.
 * A single PMREM texture is allocated per detailed quality switch and disposed on exit.
 */
import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { GRAPHICS_QUALITY, type GraphicsQuality } from './graphics-quality';

export function StudioEnvironment({ quality }: { quality: GraphicsQuality }) {
  const { scene, gl, invalidate } = useThree();
  useEffect(() => {
    const config = GRAPHICS_QUALITY[quality];
    if (!config.environment) return;
    const oldEnvironment = scene.environment;
    const oldIntensity = scene.environmentIntensity;
    const pmrem = new THREE.PMREMGenerator(gl);
    const room = new RoomEnvironment();
    const target = pmrem.fromScene(room, 0.04);
    scene.environment = target.texture;
    scene.environmentIntensity = config.environmentIntensity;
    invalidate();
    return () => {
      scene.environment = oldEnvironment;
      scene.environmentIntensity = oldIntensity;
      target.dispose();
      room.dispose();
      pmrem.dispose();
      invalidate();
    };
  }, [quality, scene, gl, invalidate]);
  return null;
}
