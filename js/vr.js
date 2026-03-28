/**
 * js/vr.js — Three.js 3D VR Showroom for GlobexSky.
 *
 * CDN: https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js
 * 100% FREE, open source.
 *
 * Usage:
 *   GlobexVR.init('vr-container')
 *   GlobexVR.loadProducts()
 *   GlobexVR.destroy()
 */
(function (global) {
  'use strict';

  function _sb() {
    return global.supabaseClient || (global.GlobexCfg && global.GlobexCfg.getClient());
  }

  var GlobexVR = {
    _scene: null,
    _camera: null,
    _renderer: null,
    _animFrameId: null,
    _products: [],
    _productMeshes: [],
    _raycaster: null,
    _mouse: null,
    _keys: {},
    _clock: null,

    // ── Initialise Three.js scene ─────────────────────────────────────────────

    init: function (containerId, onProductClick) {
      if (!global.THREE) {
        console.error('Three.js not loaded. Add CDN script before js/vr.js');
        return;
      }
      var THREE = global.THREE;
      var container = document.getElementById(containerId);
      if (!container) { console.error('Container not found: ' + containerId); return; }

      var w = container.clientWidth;
      var h = container.clientHeight || 600;

      // Scene
      var scene = new THREE.Scene();
      scene.background = new THREE.Color(0x0a0e27);
      scene.fog = new THREE.Fog(0x0a0e27, 30, 100);
      this._scene = scene;

      // Camera
      var camera = new THREE.PerspectiveCamera(75, w / h, 0.1, 1000);
      camera.position.set(0, 1.6, 10);
      this._camera = camera;

      // Renderer
      var renderer = new THREE.WebGLRenderer({ antialias: true });
      renderer.setSize(w, h);
      renderer.shadowMap.enabled = true;
      container.appendChild(renderer.domElement);
      this._renderer = renderer;

      // Lighting
      var ambient = new THREE.AmbientLight(0xffffff, 0.4);
      scene.add(ambient);
      var dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
      dirLight.position.set(10, 20, 10);
      dirLight.castShadow = true;
      scene.add(dirLight);

      // Floor
      var floorGeo = new THREE.PlaneGeometry(60, 60);
      var floorMat = new THREE.MeshLambertMaterial({ color: 0x1a1f3a });
      var floor = new THREE.Mesh(floorGeo, floorMat);
      floor.rotation.x = -Math.PI / 2;
      floor.receiveShadow = true;
      scene.add(floor);

      // Grid
      var grid = new THREE.GridHelper(60, 30, 0x0052CC, 0x0a3060);
      scene.add(grid);

      // Raycaster for click
      this._raycaster = new THREE.Raycaster();
      this._mouse = new THREE.Vector2();
      this._clock = new THREE.Clock();

      // Controls: mouse look
      var isPointerLocked = false;
      var yaw = 0, pitch = 0;

      renderer.domElement.addEventListener('click', function () {
        renderer.domElement.requestPointerLock && renderer.domElement.requestPointerLock();
      });

      document.addEventListener('pointerlockchange', function () {
        isPointerLocked = document.pointerLockElement === renderer.domElement;
      });

      document.addEventListener('mousemove', function (e) {
        if (!isPointerLocked) return;
        yaw -= e.movementX * 0.002;
        pitch -= e.movementY * 0.002;
        pitch = Math.max(-Math.PI / 3, Math.min(Math.PI / 3, pitch));
      });

      // WASD keys
      var keys = this._keys;
      document.addEventListener('keydown', function (e) { keys[e.code] = true; });
      document.addEventListener('keyup', function (e) { keys[e.code] = false; });

      // Product click (when not pointer-locked)
      container.addEventListener('click', function (e) {
        if (isPointerLocked) return;
        var rect = renderer.domElement.getBoundingClientRect();
        GlobexVR._mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        GlobexVR._mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        GlobexVR._raycaster.setFromCamera(GlobexVR._mouse, camera);
        var hits = GlobexVR._raycaster.intersectObjects(GlobexVR._productMeshes, true);
        if (hits.length > 0) {
          var mesh = hits[0].object;
          var productData = mesh.userData && mesh.userData.product;
          if (productData && typeof onProductClick === 'function') {
            onProductClick(productData);
          }
        }
      });

      // Resize
      var self = this;
      window.addEventListener('resize', function () {
        var nw = container.clientWidth;
        var nh = container.clientHeight || 600;
        camera.aspect = nw / nh;
        camera.updateProjectionMatrix();
        renderer.setSize(nw, nh);
      });

      // Animate
      function animate() {
        GlobexVR._animFrameId = requestAnimationFrame(animate);
        var delta = GlobexVR._clock.getDelta();

        // WASD movement
        var speed = 8 * delta;
        var dir = new THREE.Vector3();
        camera.getWorldDirection(dir);
        dir.y = 0; dir.normalize();
        var right = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0,1,0)).normalize();

        if (keys['KeyW'] || keys['ArrowUp'])    camera.position.addScaledVector(dir, speed);
        if (keys['KeyS'] || keys['ArrowDown'])  camera.position.addScaledVector(dir, -speed);
        if (keys['KeyA'] || keys['ArrowLeft'])  camera.position.addScaledVector(right, -speed);
        if (keys['KeyD'] || keys['ArrowRight']) camera.position.addScaledVector(right, speed);
        camera.position.y = 1.6;

        // Mouse look
        if (isPointerLocked) {
          camera.rotation.order = 'YXZ';
          camera.rotation.y = yaw;
          camera.rotation.x = pitch;
        }

        // Gentle product rotation
        GlobexVR._productMeshes.forEach(function (m) {
          m.rotation.y += 0.005;
        });

        renderer.render(scene, camera);
      }
      animate();

      return this;
    },

    // ── Load products from Supabase ──────────────────────────────────────────

    loadProducts: async function () {
      var THREE = global.THREE;
      var sb = _sb();
      if (!sb || !THREE) return;

      var result = await sb.from('products').select('id,name,price,image_url,category').limit(20);
      var products = result.data || [];

      var self = this;
      var cols = 5;
      var spacing = 4;

      products.forEach(function (product, i) {
        var col = i % cols;
        var row = Math.floor(i / cols);
        var x = (col - Math.floor(cols / 2)) * spacing;
        var z = -4 - row * spacing;

        // Pedestal
        var pedestalGeo = new THREE.CylinderGeometry(0.8, 1, 0.2, 16);
        var pedestalMat = new THREE.MeshLambertMaterial({ color: 0x0052CC });
        var pedestal = new THREE.Mesh(pedestalGeo, pedestalMat);
        pedestal.position.set(x, 0.1, z);
        self._scene.add(pedestal);

        // Product box
        var boxGeo = new THREE.BoxGeometry(1.2, 1.2, 1.2);
        var boxMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
        var box = new THREE.Mesh(boxGeo, boxMat);
        box.position.set(x, 1.6, z);
        box.castShadow = true;
        box.userData.product = product;

        // Load image texture if available
        if (product.image_url) {
          var loader = new THREE.TextureLoader();
          loader.load(product.image_url, function (tex) {
            var imgMat = new THREE.MeshLambertMaterial({ map: tex });
            box.material = imgMat;
          });
        }

        self._scene.add(box);
        self._productMeshes.push(box);

        // Price label (canvas texture)
        var canvas = document.createElement('canvas');
        canvas.width = 256; canvas.height = 64;
        var ctx = canvas.getContext('2d');
        ctx.fillStyle = '#0052CC';
        ctx.fillRect(0, 0, 256, 64);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 18px Arial';
        ctx.textAlign = 'center';
        ctx.fillText((product.name || 'Product').substring(0, 20), 128, 24);
        ctx.fillText('$' + (product.price || '0.00'), 128, 50);
        var labelTex = new THREE.CanvasTexture(canvas);
        var labelGeo = new THREE.PlaneGeometry(2, 0.5);
        var labelMat = new THREE.MeshBasicMaterial({ map: labelTex, transparent: true });
        var label = new THREE.Mesh(labelGeo, labelMat);
        label.position.set(x, 2.7, z + 0.65);
        self._scene.add(label);
      });
    },

    // ── Destroy / cleanup ────────────────────────────────────────────────────

    destroy: function () {
      if (this._animFrameId) cancelAnimationFrame(this._animFrameId);
      if (this._renderer) {
        this._renderer.dispose();
        var el = this._renderer.domElement;
        if (el && el.parentNode) el.parentNode.removeChild(el);
      }
      this._scene = null;
      this._camera = null;
      this._renderer = null;
      this._productMeshes = [];
    }
  };

  global.GlobexVR = GlobexVR;

}(typeof window !== 'undefined' ? window : this));
