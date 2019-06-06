/**
 * @author spidersharma / http://eduperiment.com/
 */

THREE.OutlinePass = function (resolution, scene, camera, selectedObjects) {

	this.renderScene = scene;
	this.renderCamera = camera;
	this.selectedObjects = selectedObjects;
	this.visibleEdgeColor = new THREE.Color(1, 1, 1);
	this.hiddenEdgeColor = new THREE.Color(0.1, 0.04, 0.02);
	this.edgeGlow = 0.0;
	this.usePatternTexture = false;
	this.edgeThickness = 1.0;
	this.edgeStrength = 3.0;
	this.downSampleRatio = 2;
	this.pulsePeriod = 0;

	THREE.Pass.call(this);

	this.resolution = (resolution !== undefined) ? new THREE.Vector2(resolution.x, resolution.y) : new THREE.Vector2(256, 256);

	var pars = {
		minFilter: THREE.LinearFilter,
		magFilter: THREE.LinearFilter,
		format: THREE.RGBAFormat
	};

	var resx = Math.round(this.resolution.x / this.downSampleRatio);
	var resy = Math.round(this.resolution.y / this.downSampleRatio);

	this.maskBufferMaterial = new THREE.MeshBasicMaterial({
		color: 0xffffff
	});
	this.maskBufferMaterial.side = THREE.DoubleSide;
	this.renderTargetMaskBuffer = new THREE.WebGLRenderTarget(this.resolution.x, this.resolution.y, pars);
	this.renderTargetMaskBuffer.texture.name = "OutlinePass.mask";
	this.renderTargetMaskBuffer.texture.generateMipmaps = false;

	this.edgeDetectionMaterial = this.getEdgeDetectionMaterial();
	this.renderTargetEdgeBuffer1 = new THREE.WebGLRenderTarget(resx, resy, pars);
	this.renderTargetEdgeBuffer1.texture.name = "OutlinePass.edge1";
	this.renderTargetEdgeBuffer1.texture.generateMipmaps = false;

	// copy material
	if (THREE.CopyShader === undefined)
		console.error("THREE.OutlinePass relies on THREE.CopyShader");

	var copyShader = THREE.CopyShader;

	this.copyUniforms = THREE.UniformsUtils.clone(copyShader.uniforms);
	this.copyUniforms["opacity"].value = 1.0;

	this.materialCopy = new THREE.ShaderMaterial({
		uniforms: this.copyUniforms,
		vertexShader: copyShader.vertexShader,
		fragmentShader: copyShader.fragmentShader,
		blending: THREE.NoBlending,
		depthTest: false,
		depthWrite: false,
		transparent: true
	});

	this.enabled = true;
	this.needsSwap = false;

	this.oldClearColor = new THREE.Color();
	this.oldClearAlpha = 1;

	this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
	this.scene = new THREE.Scene();

	this.quad = new THREE.Mesh(new THREE.PlaneBufferGeometry(2, 2), null);
	this.quad.frustumCulled = false; // Avoid getting clipped
	this.scene.add(this.quad);

	this.textureMatrix = new THREE.Matrix4();

	function replaceDepthToViewZ(string, camera) {
		var type = camera.isPerspectiveCamera ? 'perspective' : 'orthographic';

		return string.replace(/DEPTH_TO_VIEW_Z/g, type + 'DepthToViewZ');
	}
};

THREE.OutlinePass.prototype = Object.assign(Object.create(THREE.Pass.prototype), {

	constructor: THREE.OutlinePass,

	setSize: function (width, height) {
		this.renderTargetMaskBuffer.setSize(width, height);

		var resx = Math.round(width / this.downSampleRatio);
		var resy = Math.round(height / this.downSampleRatio);

		this.renderTargetEdgeBuffer1.setSize(resx, resy);
	},

	changeVisibilityOfSelectedObjects: function (bVisible) {

		function gatherSelectedMeshesCallBack(object) {
			if (object.isMesh) {
				if (bVisible) {
					object.visible = object.userData.oldVisible;
					delete object.userData.oldVisible;
				} else {
					object.userData.oldVisible = object.visible;
					object.visible = bVisible;
				}
			}
		}

		for (var i = 0; i < this.selectedObjects.length; i++) {
			var selectedObject = this.selectedObjects[i];
			selectedObject.traverse(gatherSelectedMeshesCallBack);
		}
	},

	render: function (renderer, writeBuffer, readBuffer, deltaTime) {

		this.oldClearColor.copy(renderer.getClearColor());
		this.oldClearAlpha = renderer.getClearAlpha();
		var oldAutoClear = renderer.autoClear;

		renderer.autoClear = false;

		renderer.setClearColor(0xffffff, 1);

		renderer.setRenderTarget(this.renderTargetMaskBuffer);
		renderer.clear();
		renderer.render(this.renderScene, this.renderCamera);
		this.renderScene.overrideMaterial = null;

		// 3. Apply Edge Detection Pass
		this.quad.material = this.edgeDetectionMaterial;
		this.edgeDetectionMaterial.uniforms["maskTexture"].value = this.renderTargetMaskBuffer.texture;
		this.edgeDetectionMaterial.uniforms["texSize"].value = new THREE.Vector2(this.renderTargetMaskBuffer.width / 2, this.renderTargetMaskBuffer.height / 2);
		this.edgeDetectionMaterial.uniforms["visibleEdgeColor"].value = this.visibleEdgeColor;
		this.edgeDetectionMaterial.uniforms["hiddenEdgeColor"].value = this.visibleEdgeColor;
		renderer.setRenderTarget(this.renderTargetEdgeBuffer1);
		renderer.clear();
		renderer.render(this.scene, this.camera);

		renderer.setClearColor(this.oldClearColor, this.oldClearAlpha);
		renderer.autoClear = oldAutoClear;

		this.quad.material = this.materialCopy;
		this.copyUniforms["tDiffuse"].value = this.renderTargetEdgeBuffer1.texture;
		renderer.setRenderTarget(null);
		renderer.render(this.scene, this.camera);
	},

	getEdgeDetectionMaterial: function () {
		return new THREE.ShaderMaterial({
			uniforms: {
				"maskTexture": {
					value: null
				},
				"texSize": {
					value: new THREE.Vector2(0.5, 0.5)
				},
				"visibleEdgeColor": {
					value: new THREE.Vector3(1.0, 1.0, 1.0)
				},
				"hiddenEdgeColor": {
					value: new THREE.Vector3(1.0, 1.0, 1.0)
				},
			},

			vertexShader: "varying vec2 vUv;\n\
				void main() {\n\
					vUv = uv;\n\
					gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );\n\
				}",

			fragmentShader: "varying vec2 vUv;\
				uniform sampler2D maskTexture;\
				uniform vec2 texSize;\
				uniform vec3 visibleEdgeColor;\
				uniform vec3 hiddenEdgeColor;\
				\
				void main() {\n\
					vec2 invSize = 1.0 / texSize;\
					vec4 uvOffset = vec4(1.0, 0.0, 0.0, 1.0) * vec4(invSize, invSize);\
					vec4 c1 = texture2D( maskTexture, vUv + uvOffset.xy);\
					vec4 c2 = texture2D( maskTexture, vUv - uvOffset.xy);\
					vec4 c3 = texture2D( maskTexture, vUv + uvOffset.yw);\
					vec4 c4 = texture2D( maskTexture, vUv - uvOffset.yw);\
					float diff1 = (c1.r - c2.r)*0.5;\
					float diff2 = (c3.r - c4.r)*0.5;\
					float d = length( vec2(diff1, diff2) );\
					float a1 = min(c1.g, c2.g);\
					float a2 = min(c3.g, c4.g);\
					float visibilityFactor = min(a1, a2);\
					vec3 edgeColor = 1.0 - visibilityFactor > 0.001 ? visibleEdgeColor : hiddenEdgeColor;\
					gl_FragColor = vec4(edgeColor, 1.0) * vec4(d);\
				}"
		});
	}
});
