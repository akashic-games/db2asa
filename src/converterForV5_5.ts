import {Project, Options} from "./converter";
import {Skin, AnimeParams} from "@akashic-extension/akashic-animation";
import {DragonBonesData5, ArmatureData, BoneData } from "./types/db5.5-data";
import {AnimationData,
		AnimationTimelineData,
		AnimationTimelineDataCustom,
		FrameData,
		AnimationFrameData} from "./types/db5.5-data/AnimationData";
import * as recursive from "recursive-readdir";
import * as path from "path";
import * as sizeof from "image-size";
import * as convUtils from "./convUtils";

interface KeyFrameDataObject {
	data: any;
	maxTime: number;
}
interface TempKeyFrameData {
	duration: number;
	data: FrameData | AnimationFrameData;
}

export function convertPromise(data: DragonBonesData5, pathToProj: string, project: Project, options: Options): Promise<Project> {
	return new Promise<any>((resolve, reject) => {
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
	}).then((dbAssets) => {
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
	}).then((dbAssets) => {
		return new Promise<Project>((resolve) => {
			const armatures: ArmatureData[] = dbAssets.dragonbones.armature;
			const textureInfo = dbAssets.textureInfo;

			// create skins
			for (let i = 0; i < dbAssets.files.length; i++) {
				const fileName = dbAssets.files[i];
				const textureSize = textureInfo[fileName];

				const skin = new Skin();
				skin.name = path.parse(fileName).name;
				skin.imageAssetName = skin.name;
				skin.imageSizeW = textureSize.width;
				skin.imageSizeH = textureSize.height;

				project.skins.push(skin);
				project.imageFileNames.push(fileName);
			}
			// create boneSet and animation object
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
				project.boneSets.push(boneSet);

				if (options.outputComboInfo) {
					combo.boneName = boneSet.name;
				}

				// store animation
				const dbAnimations: AnimationData[] = armature.animation;
				for (let j = 0; j < dbAnimations.length; j++) {
					const dbAnimation = dbAnimations[j];
					const animation = createAnimation(dbAnimation, dbAssets.dragonbones.frameRate, armature, options.outputUserData);
					if (options.asaanLongName) {
						animation.name = armature.name + "_" + animation.name;
					}

					project.animations.push(animation);

					if (options.outputComboInfo) {
						combo.animationNames.push(animation.name);
					}
				}

				// store cell
				for (let j = 0; j < project.skins.length; j++) {
					const skin = project.skins[j];
					const created = convUtils.createCellOnSkin(armature, skin);
					if (created && options.outputComboInfo) {
						combo.skinNames.push(skin.name);
					}
				}

				if (options.outputComboInfo) {
					project.userData.combinationInfo.push(combo);
				}
			}
			resolve(project);
		});
	});
}

/**
 * ver5.5では、`skX` が `rotate` , `scX` が `scaleFrame.X`, `scY` が `scaleFrame.Y` となっているため
 * プロパティを `skX`, `scX`, `scY` へ置き換える
 * @param key
 * @param dbKeyFrame
 */
function replaceProperty(key: string, dbKeyFrame: any) {
	if (key === "rotateFrame" && dbKeyFrame.hasOwnProperty("rotate")) {
		Object.defineProperty(dbKeyFrame, "skX", Object.getOwnPropertyDescriptor(dbKeyFrame, "rotate"));
		delete dbKeyFrame["rotate"];

	} else if (key === "scaleFrame") {
		if (dbKeyFrame.hasOwnProperty("x")) {
			Object.defineProperty(dbKeyFrame, "scX", Object.getOwnPropertyDescriptor(dbKeyFrame, "x"));
			delete dbKeyFrame["x"];
		}
		if (dbKeyFrame.hasOwnProperty("y")) {
			Object.defineProperty(dbKeyFrame, "scY", Object.getOwnPropertyDescriptor(dbKeyFrame, "y"));
			delete dbKeyFrame["y"];
		}
	}
}

/**
 * 各データをduration毎にまとめたデータを作成する
 * @param targetBoneData
 * @param name
 */
function createKeyFrameData(targetBoneData: AnimationTimelineDataCustom, name: string): KeyFrameDataObject {
	let retData: TempKeyFrameData[] = [];
	let maxTime = 0;
	Object.keys(targetBoneData).forEach((key: keyof AnimationTimelineData) => {
		const frameData = targetBoneData[key];
		// FrameData objectのみ通す
		if (typeof frameData !== "object") return;

		let time = 0;
		let dur = 0;
		for (let j = 0; j < frameData.length; j++) {
			const dbKeyFrame: FrameData | AnimationFrameData = frameData[j];
			dur = time;
			time += dbKeyFrame.duration;

			replaceProperty(key, dbKeyFrame);
			const target = retData.find((data) => {
				return data.duration === dur;
			});

			if (target) {
				// 同durでデータがある場合、データを結合
				Object.assign(target.data, dbKeyFrame);
			} else {
				if (time > maxTime) {
					maxTime = time;
				}
				retData.push({duration: dur, data: dbKeyFrame });
			}
		}
	});
	return { data: retData, maxTime: maxTime};
}

function createAnimation(dbAnimation: AnimationData, fps: number, armature: ArmatureData, isUserData: boolean): AnimeParams.Animation {

	const bones: BoneData[] = armature.bone;
	const animation = new AnimeParams.Animation();
	let maxTime = 0;

	bones.forEach((boneData) => {
		const curveTie = new AnimeParams.CurveTie();
		curveTie.boneName = boneData.name;
		let targetBoneData: AnimationTimelineDataCustom = dbAnimation.bone.find((data) => {
			return data.name === boneData.name;
		});

		if (!targetBoneData) {
			if (!boneData.transform) return;

			// 対象のデータがない場合、boneData.transformから生成
			targetBoneData = {tempFrame: [boneData.transform], name: boneData.name, empty: true };
		}

		const keyFrameDataObj = createKeyFrameData(targetBoneData, boneData.name);
		const frameData: any[] = keyFrameDataObj.data;
		if (keyFrameDataObj.maxTime > maxTime)
			maxTime = keyFrameDataObj.maxTime;

		convUtils.dbTransformAttributes.forEach((dbAttr: string) => {
			const curve = new AnimeParams.Curve<number>();
			curve.attribute = convUtils.dbAttr2asaAttr[dbAttr];

			frameData.forEach((data, idx: number) => {
				const dbKeyFrame: any = data.data;
				const keyFrame = new AnimeParams.KeyFrame<number>();
				keyFrame.time = data.duration;

				// キーフレームの持つ値は基本姿勢からの差分の模様
				const dbBone = convUtils.getBoneByName(bones, targetBoneData.name);
				const baseValue = dbBone.transform[dbAttr] || convUtils.defaultTransformValues[dbAttr];
				let animValue = dbKeyFrame[dbAttr];
				// 全てのデータにattrが入っていない(値が前と同じだと省略される)ため、attrがなければ前データのattrを参照しそれでも無ければデフォルト値とする
				if (!targetBoneData.empty && !dbKeyFrame[dbAttr]) {
					for (let i = idx - 1; i >= 0; i-- ) {
						const beforeData: any = frameData[i];
						if (beforeData.data[dbAttr] ) {
							animValue = beforeData.data[dbAttr];
							break;
						}
					}
				}
				if (!animValue || targetBoneData.empty)
					animValue = convUtils.defaultTransformValues[dbAttr];

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
					let ey = convUtils.getBoneByName(bones, targetBoneData.name).transform[dbAttr] || 0;
					const nextData: any = frameData[idx + 1];
					ey += nextData[dbAttr] || convUtils.defaultTransformValues[dbAttr];

					const xScale = dbKeyFrame.duration;
					const yScale = ey - sy;
					keyFrame.ipCurve.values[0] *= xScale;
					keyFrame.ipCurve.values[1] *= yScale;
					keyFrame.ipCurve.values[2] *= xScale;
					keyFrame.ipCurve.values[3] *= yScale;
					keyFrame.ipCurve.values[2] -= dbKeyFrame.duration;
					keyFrame.ipCurve.values[3] -= ey - sy;

				} else if (dbKeyFrame.tweenEasing === 0) {
					keyFrame.ipType = "linear";
				} else if (dbKeyFrame.tweenEasing === null) {
					keyFrame.ipType = undefined;
				} else {
					keyFrame.ipType = "linear"; // 代替
				}
				curve.keyFrames.push(keyFrame);
			});
			curveTie.curves.push(curve);
		});

		if (isUserData) {
			const dbKeyFrames: any[] = frameData;
			const curve = new AnimeParams.Curve<any>();
			curve.attribute = "userData";

			for (let i = 0; i < dbKeyFrames.length; i++) {
				const dbKeyFrame = dbKeyFrames[i];
				const keyFrame = new AnimeParams.KeyFrame<any>();
				keyFrame.time = dbKeyFrame.duration;
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

		const cvData = curveTie.curves.find((data) => {
			return data.attribute === "cv";
		});

		// Slotアニメーション
		const dbSlotAnime = getSlotAnimeByBoneName(targetBoneData.name, frameData, armature.slot);
		if (!cvData && dbSlotAnime) {
			// スロットアニメーションは "セルの切り替え" と "透明度" のたかだか２つのカーブからなる
			let cellCurve = createCellAnimation(dbSlotAnime, armature, curveTie.boneName);
			if (cellCurve) {
				curveTie.curves.push(cellCurve);
			}

			const alphaCurve = createCellAlphaAnimation(dbSlotAnime);
			if (alphaCurve) {
				curveTie.curves.push(alphaCurve);
			}
		}
		animation.curveTies[curveTie.boneName] = curveTie;
	});

	// bone アニメーション
	animation.frameCount = maxTime;
	animation.name = dbAnimation.name;
	animation.fps = fps;

	return animation;
}

function createCellAnimation(dbSlotAnime: any, armature: any, boneName: string): AnimeParams.Curve<AnimeParams.CellValue> {
	const curve = new AnimeParams.Curve<AnimeParams.CellValue>();
	curve.attribute = "cv";

	for (let j = 0; j < dbSlotAnime.length; j++) {
		const dbKeyFrame = dbSlotAnime[j];
		const keyFrame = new AnimeParams.KeyFrame<AnimeParams.CellValue>();

		keyFrame.time = dbKeyFrame.duration;
		// undefinedならデフォルトとして最初のimageを使う
		const displayIndex = dbKeyFrame.data.displayIndex || 0;

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

function createCellAlphaAnimation(dbSlotAnime: any): AnimeParams.Curve<number> {
	const curve = new AnimeParams.Curve<number>();
	curve.attribute = "alpha";

	const dbKeyFrames: any[] = dbSlotAnime;

	for (let i = 0; i < dbKeyFrames.length; i++) {
		const dbKeyFrame = dbKeyFrames[i];
		const keyFrame = new AnimeParams.KeyFrame<number>();

		keyFrame.time = dbKeyFrame.duration;
		// alpha値はアニメーション(colorFrame)の値を用いる
		keyFrame.value = convUtils.getKeyFrameAlpha(dbKeyFrame.data);

		keyFrame.ipCurve = undefined;

		if (dbKeyFrame.data.curve) { // ベジェ補間の情報がある
			keyFrame.ipType = "bezier";
			keyFrame.ipCurve = new AnimeParams.IpCurve();

			const dbCurve: any[] = dbKeyFrame.data.curve;
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
			keyFrame.ipCurve.values[2] -= dbKeyFrame.duration;
			keyFrame.ipCurve.values[3] -= ey - sy;

		} else if (dbKeyFrame.tweenEasing === 0) {
			keyFrame.ipType = "linear";
		} else if (dbKeyFrame.tweenEasing === null) {
			keyFrame.ipType = undefined;
		} else {
			keyFrame.ipType = "linear"; // 代替
		}
		curve.keyFrames.push(keyFrame);
	}

	return (curve.keyFrames.length > 0) ? curve : undefined;
}

// amature.slotと対になるアニメーションデータを返す
function getSlotAnimeByBoneName(boneName: string, slotAnimes: any[], dbSlots: any[]): any {
	const dbSlot = convUtils.getSlotForBone(boneName, dbSlots);
	if (dbSlot) {
		if (slotAnimes != null) {
			return slotAnimes;
		}
		// あるボーンについてarmature.slotはあるがanimationデータがないケース
		// ここに入る想定はないが、デフォルトとするanimationデータを生成し返す
		return {
			"duration": 0,
			"data": {
				"duration": 0,
				"tweenEasing": 0
			}
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
	// 5.5ではdisplayデータに `type` がないためそのまま変換
	return convUtils.normalizeDisplayName(slot.display[displayIndex].name);
}

