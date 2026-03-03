import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

interface Props {
  url: string;
  isDarkMode?: boolean;
}

const GlbViewer: React.FC<Props> = ({ url, isDarkMode = true }) => {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const w = mount.clientWidth || 400;
    const h = mount.clientHeight || 400;

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(isDarkMode ? 0x111827 : 0xf1f5f9);

    // Camera
    const camera = new THREE.PerspectiveCamera(45, w / h, 0.001, 1_000_000);

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(w, h);
    mount.appendChild(renderer.domElement);

    // Orbit controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.screenSpacePanning = true;

    // Lighting
    scene.add(new THREE.AmbientLight(0xffffff, 0.7));
    const sunLight = new THREE.DirectionalLight(0xffffff, 0.9);
    sunLight.position.set(3, 5, 4);
    scene.add(sunLight);
    const fillLight = new THREE.DirectionalLight(0xaabbff, 0.35);
    fillLight.position.set(-3, -2, -3);
    scene.add(fillLight);

    // Load GLB
    const loader = new GLTFLoader();
    loader.load(url, (gltf) => {
      const model = gltf.scene;

      // Center model at origin
      const box = new THREE.Box3().setFromObject(model);
      const center = new THREE.Vector3();
      box.getCenter(center);
      model.position.sub(center);

      // Position camera to fit model
      const size = new THREE.Vector3();
      box.getSize(size);
      const maxDim = Math.max(size.x, size.y, size.z);
      const fitDist = maxDim * 1.8;

      camera.position.set(0, maxDim * 0.3, fitDist);
      camera.near = fitDist * 0.001;
      camera.far = fitDist * 200;
      camera.updateProjectionMatrix();
      controls.target.set(0, 0, 0);
      controls.update();

      // Override materials to match STL viewer appearance
      model.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          (child as THREE.Mesh).material = new THREE.MeshPhongMaterial({
            color: isDarkMode ? 0x9ab0cc : 0x6b8fbd,
            specular: 0x222222,
            shininess: 50,
            side: THREE.DoubleSide,
          });
        }
      });

      scene.add(model);
    });

    // Render loop
    let animId: number;
    const animate = () => {
      animId = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // Responsive resize
    const ro = new ResizeObserver(() => {
      const nw = mount.clientWidth;
      const nh = mount.clientHeight;
      camera.aspect = nw / nh;
      camera.updateProjectionMatrix();
      renderer.setSize(nw, nh);
    });
    ro.observe(mount);

    return () => {
      cancelAnimationFrame(animId);
      ro.disconnect();
      controls.dispose();
      renderer.dispose();
      if (mount.contains(renderer.domElement)) {
        mount.removeChild(renderer.domElement);
      }
    };
  }, [url, isDarkMode]);

  return <div ref={mountRef} className="w-full h-full" />;
};

export default GlbViewer;
