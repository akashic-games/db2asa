"use strict"

const C = require("../bin/converter.js");

describe("C.", function () {

	describe("createRelatedFileInfo()", function() {
		it("should return related file info object constructed properly", function() {
			const asapj = {
				boneSetFileNames: ["hoge.asabn"],
				skinFileNames: ["hoge.asask"],
				animationFileNames: ["hoge.asaan"],
			};
			const imageFileNames = ["hoge.png"];

			const r = new C.RelatedFileInfo(imageFileNames, asapj);

			expect(JSON.stringify(r)).toBe(JSON.stringify({
				boneSetFileNames: ["hoge.asabn"],
				skinFileNames: ["hoge.asask"],
				animationFileNames: ["hoge.asaan"],
				imageFileNames: ["hoge.png"]
			}));
		});
	});
});

describe("converter", function() {

	describe("given stickman.json with less option", function() {
		it("can convert all", function(done) {
			const promise = C.createConvertPromise({
				asaanLongName: false,
				outputUserData: false,
				outputComboInfo: false,
				outputRelatedFileInfo: false,
				projFileName: "spec/project/stickman/stickman.json",
				outDir: "./",
				prefixes: ["", "", "", ""]
			});

			promise.then(
				function(proj) {
					expect(proj).toBeDefined();

					expect(proj.skins.length).toEqual(4);
					expect(proj.boneSets.length).toEqual(2);
					expect(proj.animations.length).toEqual(6);

					// test outputComboInfo and outputRelatedFileInfo options
					expect(proj.usrData).toBeUndefined();

					// test asaanLongName option
					expect(proj.animations[0].name).toEqual("jump");

					// test outputUserData option
					proj.animations.forEach(function(anim) {
						for (var key in anim.curveTies) {
							if (anim.curveTies.hasOwnProperty(key)) {
								var curves = anim.curveTies[key].curves;
								curves.forEach(function(c) {
									expect(c.attribute).not.toBe("userData");
								});
							}
						}
					});

					done();
				}
			).catch(
				function(err) {
					done.fail(err);
				}
			);
		});
	});

	describe("given stickman.json with full option", function() {
		let promise;

		beforeEach(function() {
			promise = C.createConvertPromise({
				asaanLongName: true,
				outputUserData: true,
				outputComboInfo: true,
				outputRelatedFileInfo: true,
				projFileName: "spec/project/stickman/stickman.json",
				outDir: "./",
				prefixes: ["pj_", "bn_", "sk_", "an_"]
			});
		});

		it("can convert animation", function(done) {
			promise.then(
				function(proj) {
					expect(proj).toBeDefined();

					expect(proj.animations.length).toEqual(6);
					var jumpAnim = proj.animations.find(function(a) {
						return a.name === "Armature_jump";
					});
					expect(jumpAnim).toBeDefined();
					expect(jumpAnim.curveTies["body"]).toBeDefined();
					expect(jumpAnim.curveTies["body"].curves.length).toBeGreaterThan(0);
					var userDataCurve = jumpAnim.curveTies["body"].curves.find(function(c) {
						return c.attribute === "userData";
					});
					expect(userDataCurve).toBeDefined();
					expect(userDataCurve.keyFrames.length).toEqual(1);
					expect(userDataCurve.keyFrames[0].time).toEqual(14);
					expect(userDataCurve.keyFrames[0].value.event).toBe("body-event");
					expect(userDataCurve.keyFrames[0].value.action).toBe("body-action");
					expect(userDataCurve.keyFrames[0].value.sound).toBe("body-sound");

					done();
				}
			).catch(
				function(err) {
					done.fail(err);
				}
			);
		});

		it("can convert skin", function(done) {
			promise.then(
				function(proj) {
					expect(proj).toBeDefined();

					expect(proj.skins.length).toEqual(4);
					var headSkin = proj.skins.find(function(s) {
						return s.name === "head";
					});
					expect(headSkin).toBeDefined();
					expect(headSkin.imageAssetName).toBe("head");
					expect(headSkin.imageSizeW).toBe(128);
					expect(headSkin.imageSizeH).toBe(96);
					expect(Object.keys(headSkin.cells).length).toEqual(2);
					expect(headSkin.cells["bone10_head"]).toBeDefined();
					expect(headSkin.cells["head_head"]).toBeDefined();

					done();
				}
			).catch(
				function(err) {
					done.fail(err);
				}
			);
		});

		it("can convert bone", function(done) {
			promise.then(
				function(proj) {
					expect(proj).toBeDefined();

					expect(proj.boneSets.length).toEqual(2);
					var boneSet = proj.boneSets.find(function(b) {
						return b.name === "Armature";
					});
					expect(boneSet).toBeDefined();
					expect(boneSet.bones.length).toEqual(12);
					var root = boneSet.bones.find(function(b) {
						return b.name === "root";
					});
					expect(root).toBeDefined();
					expect(root.parentIndex).toEqual(-1);

					done();
				}
			).catch(
				function(err) {
					done.fail(err);
				}
			);
		});
	});

	describe("given emptyman.json with less option", function() {
		it("can convert all", function(done) {
			const promise = C.createConvertPromise({
				asaanLongName: false,
				outputUserData: false,
				outputComboInfo: false,
				outputRelatedFileInfo: false,
				projFileName: "spec/project/emptyman/emptyman.json",
				outDir: "./",
				prefixes: ["", "", "", ""]
			});

			promise.then(
				function(proj) {
					expect(proj).toBeDefined();
					expect(proj.name).toBe("emptyman");
					expect(proj.skins.length).toEqual(0);
					expect(proj.animations.length).toEqual(0);
					expect(proj.imageFileNames.length).toEqual(0);
					expect(proj.boneSets.length).toEqual(1);
					expect(proj.boneSets[0].name).toBe("Armature");
					done();
				}
			).catch(
				function(err) {
					done.fail(err);
				}
			);
		});
	});

	describe("given nokeyman.json with less option", function() {
		it("can convert all", function(done) {
			const promise = C.createConvertPromise({
				asaanLongName: false,
				outputUserData: false,
				outputComboInfo: false,
				outputRelatedFileInfo: false,
				projFileName: "spec/project/nokeyman/nokeyman.json",
				outDir: "./",
				prefixes: ["", "", "", ""]
			});

			promise.then(
				function(proj) {
					expect(proj).toBeDefined();
					expect(proj.name).toBe("nokeyman");
					expect(proj.skins.length).toEqual(2);
					expect(proj.animations.length).toEqual(1);
					expect(proj.animations[0].frameCount).toEqual(1);
					expect(proj.imageFileNames.length).toEqual(2);
					expect(proj.boneSets.length).toEqual(1);
					expect(proj.boneSets[0].name).toBe("Armature");
					done();
				}
			).catch(
				function(err) {
					done.fail(err);
				}
			);
		});
	});
});
