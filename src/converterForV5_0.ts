import {Project, Options} from "./converter";
import {Skin, AnimeParams} from "@akashic-extension/akashic-animation";
import * as recursive from "recursive-readdir";
import * as path from "path";
import * as sizeof from "image-size";
import * as convUtils from "./convUtils";

export function convertPromise(data: any, pathToProj: string, proj: Project, options: Options): Promise<Project> {
	return new Promise<any>(
		(resolve, reject) => {
			recursive(path.join(pathToProj, "texture"), (err: Error, files: string[]) => {
				if (!err) {
					resolve({
						dragonbones: data,
						files: files,
						textureInfo: {}
					});
				} else if ((<any>err).code === "ENOENT") { // "texture" directory is not found
					resolve({
						dragonbones: data,
						files: [],
						textureInfo: {}
					});
				} else {
					reject(JSON.stringify(err));
				}
			});
		}
	).then(
		(dbAssets: any) => {
			if (dbAssets.files.length > 0) {
				return Promise.all(dbAssets.files.map((file: string) => {
					return new Promise((resolve, reject) => {
						sizeof(file, (err: Error, dimensions: any) => {
							if (!err) {
								dbAssets.textureInfo[file] = dimensions;
								resolve();
							} else {
								reject(err);
							}
						});
					});
				})).then(() => dbAssets);
			} else {
				return dbAssets;
			}
		}
	).then(
		(results: any[]) => {
			return new Promise<Project>((resolve) => {
				const dbAssets: any = results;
				const armatures: any[] = dbAssets.dragonbones.armature;
				const textureInfo = dbAssets.textureInfo;

				// store skins (not having cells yet)
				for (let i = 0; i < dbAssets.files.length; i++) {
					const fileName = dbAssets.files[i];
					const textureSize = textureInfo[fileName];

					const skin = new Skin();
					skin.name = path.parse(fileName).name;
					skin.imageAssetName = skin.name;
					skin.imageSizeW = textureSize.width;
					skin.imageSizeH = textureSize.height;

					proj.skins.push(skin);
					proj.imageFileNames.push(fileName);
				}

				for (let i = 0; i < armatures.length; i++) {
					const armature = armatures[i];

					if (armature.ik && armature.ik.length > 0) {
						console.log("IK is not supported, skip. armature name=" + armature.name);
						continue;
					}

					let combo: any = undefined;
					if (options.outputComboInfo) {
						combo = { boneName: undefined, animationNames: [], skinNames: [] };
					}

					// store bonesets
					const boneSet = convUtils.createBoneSet(armature.bone, armature.slot, armature.name);
					proj.boneSets.push(boneSet);

					if (options.outputComboInfo) {
						combo.boneName = boneSet.name;
					}

					// store animation
					const dbAnimations = armature.animation;
					for (let j = 0; j < dbAnimations.length; j++) {
						const dbAnimation = dbAnimations[j];
						const animation = createAnimation(dbAnimation, dbAssets.dragonbones.frameRate, armature, options.outputUserData);

						if (options.asaanLongName) {
							animation.name = armature.name + "_" + animation.name;
						}

						proj.animations.push(animation);

						if (options.outputComboInfo) {
							combo.animationNames.push(animation.name);
						}
					}

					// store cell
					for (let j = 0; j < proj.skins.length; j++) {
						const skin = proj.skins[j];
						const created = convUtils.createCellOnSkin(armature, skin);
						if (created && options.outputComboInfo) {
							combo.skinNames.push(skin.name);
						}
					}

					if (options.outputComboInfo) {
						proj.userData.combinationInfo.push(combo);
					}
				}

				resolve(proj);
			});
		}
	);
}

function createAnimation(dbAnimation: any, fps: number, armature: any, isUserDataOutput: boolean): AnimeParams.Animation {
	const bones: any[] = armature.bone;

	const animation = new AnimeParams.Animation();

	let maxTime = 0;

	// bone アニメーション
	for (let i = 0; i < dbAnimation.bone.length; i++) {
		var dbBoneAnime = dbAnimation.bone[i];

		var curveTie = new AnimeParams.CurveTie();
		curveTie.boneName = dbBoneAnime.name;

		convUtils.dbTransformAttributes.forEach((dbAttr: string) => {
			const dbKeyFrames: any[] = dbBoneAnime.frame;
			const curve = new AnimeParams.Curve<number>();
			curve.attribute = convUtils.dbAttr2asaAttr[dbAttr];

			let time = 0;
			for (let j = 0; j < dbKeyFrames.length; j++) {
				const dbKeyFrame = dbKeyFrames[j];

				const keyFrame = new AnimeParams.KeyFrame<number>();
				keyFrame.time = time;
				time += dbKeyFrame.duration;
				if (time > maxTime) {
					maxTime = time;
				}

				// キーフレームの持つ値は基本姿勢からの差分の模様
				const dbBone = convUtils.getBoneByName(bones, dbBoneAnime.name);
				const baseValue = dbBone.transform[dbAttr] || convUtils.defaultTransformValues[dbAttr];
				const animValue = dbKeyFrame.transform[dbAttr] || convUtils.defaultTransformValues[dbAttr];
				keyFrame.value = convUtils.dbTransformComposeOps[dbAttr](baseValue, animValue);

				if (dbKeyFrame.curve) { // ベジェ補間の情報がある
					keyFrame.ipType = "bezier";
					keyFrame.ipCurve = new AnimeParams.IpCurve();
					const dbCurve: any[] = dbKeyFrame.curve;
					for (let k = 0; k < dbCurve.length; k++) {
						keyFrame.ipCurve.values.push(dbCurve[k]);
					}

					// DragonBonesが(0, 0) - (1, 1)の空間にベジェ曲線の制御点を配置するのに対し、
					// akashic-animationは正規化されておらず、またそれぞれ始点と終点との相対値になっている。
					// ここで変換する。
					const sy = keyFrame.value;
					let ey = convUtils.getBoneByName(bones, dbBoneAnime.name).transform[dbAttr] || 0;
					ey += dbKeyFrames[j + 1].transform[dbAttr] || convUtils.defaultTransformValues[dbAttr];

					const xScale = dbKeyFrame.duration;
					const yScale = ey - sy;
					keyFrame.ipCurve.values[0] *= xScale;
					keyFrame.ipCurve.values[1] *= yScale;
					keyFrame.ipCurve.values[2] *= xScale;
					keyFrame.ipCurve.values[3] *= yScale;
					//
					keyFrame.ipCurve.values[2] -= dbKeyFrame.duration;
					keyFrame.ipCurve.values[3] -= ey - sy;

				} else if (dbKeyFrame.tweenEasing === 0) {
					keyFrame.ipType = "linear";
				} else if (dbKeyFrame.tweenEasing === null) {
					keyFrame.ipType = undefined;
				} else {
					console.log("easing '" + dbKeyFrame.tweenEasing + "' not supported");
					keyFrame.ipType = "linear"; // 代替
				}

				curve.keyFrames.push(keyFrame);
			}

			curveTie.curves.push(curve);
		});

		if (isUserDataOutput) {
			const dbKeyFrames: any[] = dbBoneAnime.frame;
			const curve = new AnimeParams.Curve<any>();
			curve.attribute = "userData";

			let time = 0;
			for (let i = 0; i < dbKeyFrames.length; i++) {
				const dbKeyFrame = dbKeyFrames[i];

				const keyFrame = new AnimeParams.KeyFrame<any>();
				keyFrame.time = time;

				time += dbKeyFrame.duration;
				if (time > maxTime) {
					maxTime = time;
				}

				// 数ではないので補間しない
				keyFrame.ipType = undefined;

				const userData: { [key: string]: string } = {};
				if (dbKeyFrame.event) userData["event"] = dbKeyFrame.event;
				if (dbKeyFrame.action) userData["action"] = dbKeyFrame.action;
				if (dbKeyFrame.sound) userData["sound"] = dbKeyFrame.sound;

				if (Object.keys(userData).length > 0) {
					keyFrame.value = userData;
					curve.keyFrames.push(keyFrame);
				}
			}

			if (curve.keyFrames.length > 0) {
				curveTie.curves.push(curve);
			}
		}

		// Slotアニメーション
		const dbSlotAnime = getSlotAnimeByBoneName(dbBoneAnime.name, dbAnimation.slot, bones, armature.slot);
		if (dbSlotAnime) { // ボーンにスロットが存在している
			const info = { maxTime: maxTime };

			// スロットアニメーションは "セルの切り替え" と "透明度" のたかだか２つのカーブからなる

			let cellCurve = createCellAnimation(dbSlotAnime, armature, curveTie.boneName, info);
			if (cellCurve) {
				curveTie.curves.push(cellCurve);
			}

			const alphaCurve = createCellAlphaAnimation(dbSlotAnime, armature, curveTie.boneName, info);
			if (alphaCurve) {
				curveTie.curves.push(alphaCurve);
			}

			maxTime = info.maxTime;
		}

		animation.curveTies[curveTie.boneName] = curveTie;
	}

	animation.frameCount = maxTime;
	animation.name = dbAnimation.name;
	animation.fps = fps;

	return animation;
}

function createCellAlphaAnimation(dbSlotAnime: any, armature: any, boneName: string, info: any): AnimeParams.Curve<number> {
	const curve = new AnimeParams.Curve<number>();
	curve.attribute = "alpha";

	const dbKeyFrames: any[] = dbSlotAnime.frame;
	let time = 0;

	for (let i = 0; i < dbKeyFrames.length; i++) {
		const dbKeyFrame = dbKeyFrames[i];
		const keyFrame = new AnimeParams.KeyFrame<number>();

		keyFrame.time = time;
		time += dbKeyFrame.duration;
		if (time > info.maxTime) {
			info.maxTime = time;
		}

		// alpha値は基本姿勢(armature.slot)の値を一切参照せず
		// スロットアニメーション(armature.animation.slot)の値を用いる
		keyFrame.value = convUtils.getKeyFrameAlpha(dbKeyFrame);

		keyFrame.ipCurve = undefined;

		if (dbKeyFrame.curve) { // ベジェ補間の情報がある
			keyFrame.ipType = "bezier";
			keyFrame.ipCurve = new AnimeParams.IpCurve();

			const dbCurve: any[] = dbKeyFrame.curve;
			for (let k = 0; k < dbCurve.length; k++) {
				keyFrame.ipCurve.values.push(dbCurve[k]);
			}

			// DragonBonesが(0, 0) - (1, 1)の空間にベジェ曲線の制御点を配置するのに対し、
			// akashic-animationは正規化されておらず、またそれぞれ始点と終点との相対値になっている。
			// ここで変換する。

			const sy = keyFrame.value;
			const ey = convUtils.getKeyFrameAlpha(dbKeyFrames[i + 1]);

			const xScale = dbKeyFrame.duration;
			const yScale = ey - sy;
			keyFrame.ipCurve.values[0] *= xScale;
			keyFrame.ipCurve.values[1] *= yScale;
			keyFrame.ipCurve.values[2] *= xScale;
			keyFrame.ipCurve.values[3] *= yScale;
			//
			keyFrame.ipCurve.values[2] -= dbKeyFrame.duration;
			keyFrame.ipCurve.values[3] -= ey - sy;

		} else if (dbKeyFrame.tweenEasing === 0) {
			keyFrame.ipType = "linear";
		} else if (dbKeyFrame.tweenEasing === null) {
			keyFrame.ipType = undefined;
		} else {
			console.log("easing '" + dbKeyFrame.tweenEasing + "' not supported");
			keyFrame.ipType = "linear"; // 代替
		}

		curve.keyFrames.push(keyFrame);
	}

	return (curve.keyFrames.length > 0) ? curve : undefined;
}

function createCellAnimation(dbSlotAnime: any, armature: any, boneName: string, info: any): AnimeParams.Curve<AnimeParams.CellValue> {
	const curve = new AnimeParams.Curve<AnimeParams.CellValue>();
	curve.attribute = "cv";
	let time = 0;

	for (let j = 0; j < dbSlotAnime.frame.length; j++) {
		const dbKeyFrame = dbSlotAnime.frame[j];
		const keyFrame = new AnimeParams.KeyFrame<AnimeParams.CellValue>();

		keyFrame.time = time;
		time += dbKeyFrame.duration;
		if (time > info.maxTime) {
			info.maxTime = time;
		}

		// undefinedならデフォルトとして最初のimageを使う
		const displayIndex = dbKeyFrame.displayIndex || 0;

		// 数ではないので補間しない
		keyFrame.ipType = undefined;

		if (displayIndex !== -1) {
			keyFrame.value = new AnimeParams.CellValue();
			keyFrame.value.skinName = getDisplayImageName(armature, boneName, displayIndex);
			const slotDetail = convUtils.getSlotDetailForBone(armature, boneName);
			keyFrame.value.cellName = slotDetail.name + "_" + convUtils.normalizeDisplayName(slotDetail.display[displayIndex].name);
		} else { // 非表示
			keyFrame.value = undefined;
		}

		curve.keyFrames.push(keyFrame);
	}

	return (curve.keyFrames.length > 0) ? curve : undefined;
}

// boneにぶら下がるスロットを探し、そのスロットのアニメーションを返す
function getSlotAnimeByBoneName(boneName: string, slotAnimes: any[], dbBones: any[], dbSlots: any[]): any {
	const dbSlot = convUtils.getSlotForBone(boneName, dbSlots);

	if (dbSlot) {
		for (let i = 0; i < slotAnimes.length; i++) {
			if (slotAnimes[i].name === dbSlot.name) {
				return slotAnimes[i];
			}
		}

		// あるボーンについてarmature.slotはあるがanimation.slotアニメがないとき
		//
		// DBsはarmatureのslot情報を用いるようにみえる
		// ここではarmature.slotに基づいてanimation.slotを生成し返す
		return {
			"name": boneName,
			"frame": [
				{
					"displayIndex": dbSlot.displayIndex,
					"tweenEasing": 0,
					"duration": 1,
					"color": {} // こちらはdbSlotから引き継がない
				}
			]
		};
	}

	return undefined;
}

// ボーンに配置される displayIndex番目のdisplay（画像）の名前を得る
function getDisplayImageName(armature: any, boneName: string, displayIndex: number): string {
	const slot = convUtils.getSlotDetailForBone(armature, boneName);

	if (!slot) {
		return undefined;
	}

	if (slot.display[displayIndex].type !== "image") {
		throw new Error(
			`Invalid display type(${slot.display[displayIndex].type}). ` +
			`armature name=${armature.name}, bone name=${boneName}, display index=${displayIndex}`
		);
	}

	return convUtils.normalizeDisplayName(slot.display[displayIndex].name);
}
