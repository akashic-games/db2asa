const g = require("@akashic/akashic-engine");
(<any>global).g = g;
import { Skin, Bone, BoneSet, Container, AnimeParams, Cell } from "@akashic-extension/akashic-animation";
import * as path from "path";
import * as fs from "fs-extra";
import * as sizeof from "image-size";
import * as recursive from "recursive-readdir";
import * as U from "./Utils";
import {convertPromise} from "./converterVer55";

let vlog: U.Logger = undefined;

// コンバート設定
export interface Options {
	asaanLongName?: boolean;
	outputUserData?: boolean;
	outputComboInfo?: boolean;
	outputRelatedFileInfo?: boolean;
	verbose?: boolean;
	projFileName: string;
	outDir: string;
	prefixes: string[];
}

export class RelatedFileInfo {
	boneSetFileNames: string[];
	skinFileNames: string[];
	animationFileNames: string[];
	imageFileNames: string[];

	constructor(imageFileNames: string[], contents: any) {
		this.boneSetFileNames = contents.boneSetFileNames;
		this.skinFileNames = contents.skinFileNames;
		this.animationFileNames = contents.animationFileNames;
		this.imageFileNames = imageFileNames;
	}
}

// コンバート後のデータを取りまとめるクラス
export class Project {
	name: string;
	skins: Skin[] = [];
	boneSets: BoneSet[] = [];
	animations: AnimeParams.Animation[] = [];
	userData: any;
	imageFileNames: string[] = [];

	constructor(allocateUserData: boolean) {
		if (allocateUserData) {
			this.userData = {};
		}
	}
}

const FILEFORMAT_VERSION = "2.0.0";
const FS_WRITE_OPTION: fs.OpenOptions = { encoding: "utf8" };
enum Prefix {
	Proj,
	Bone,
	Skin,
	Anim
}

// DragonBonesのtransform属性表
export const dbTransformAttributes = [
	"x", "y", "skX", "scX", "scY"
];

// Dragonbonsの属性ごとの合成演算関数テーブル
export const dbTransformComposeOps: {[key: string]: (a: number, b: number) => number} = {
	"x":   (a: number, b: number) => a + b,
	"y":   (a: number, b: number) => a + b,
	"skX": (a: number, b: number) => a + b,
	"scX": (a: number, b: number) => a * b,
	"scY": (a: number, b: number) => a * b
};

// DragonBonesのtransform属性の指定がないときに代替する値のテーブル
export const defaultTransformValues: {[key: string]: any} = {
	x: 0,
	y: 0,
	skX: 0,
	scX: 1,
	scY: 1
};

// DragonBonesの属性名を対応するakashic-animationの属性名に変換するテーブル
export const dbAttr2asaAttr: {[key: string]: string} = {
	x: "tx",
	y: "ty",
	skX: "rz",
	scX: "sx",
	scY: "sy"
};

export function readFilePromise(options: Options): any {
	return new Promise<void>(
		(resolve: () => void, reject: (error: any) => void) => {
			fs.ensureDir(options.outDir, (err: any) => {
				err ? reject(err) : resolve();
			});
		}
	).then(
		() => {
			return new Promise<any>((resolve: (data: any) => void, reject: (error: any) => void) => {
				fs.readFile(options.projFileName, { encoding: "utf8" }, (err: Error, data: string) => {
					if (! err) {
						resolve(JSON.parse(data));
					} else {
						reject(err);
					}
				});
			});
		}
	);
}

export function createConvertPromise(dragonbones: any, pathToProj: string, proj: Project, options: Options): Promise<Project> {
	return new Promise<any>(
		(resolve: (data: any) => void, reject: (error: any) => void) => {
			recursive(path.join(pathToProj, "texture"), (err: Error, files: string[]) => {
				if (! err) {
					resolve({
						dragonbones: dragonbones,
						files: files,
						textureInfo: {}
					});
				} else if ((<any>err).code === "ENOENT") { // "texture" directory is not found
					resolve({
						dragonbones: dragonbones,
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
					return new Promise<any>((resolve: (data: any) => void, reject: (error: any) => void) => {
						// recursiveはフルパスを返すのでここではjoin()などせずそのまま用いる
						sizeof(file, (err: Error, dimensions: any) => {
							if (! err) {
								dbAssets.textureInfo[file] = dimensions;
								resolve(dbAssets);
							} else {
								reject(err);
							}
						});
					});
				}));
			} else {
				return Promise.all(<any>[
					new Promise<any>((resolve: (data: any) => void, reject: (error: any) => void) => {
						resolve(dbAssets);
					})
				]);
			}
		}
	).then(
		(results: any[]) => {
			return new Promise<Project>((resolve: (proj: Project) => void) => {
				// Promise.Allを経由するとめいめいの結果が配列に入る。
				// どのpromiseも同じインスタンスを返すので配列のどの要素も同じインスタンスになる。
				const dbAssets: any = results[0];
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
					const boneSet = createBoneSet(armature.bone, armature.slot, armature.name);
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
						const created = createCellOnSkin(armature, skin);
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

export function convert(options: Options): void {
	vlog = new U.Logger(!!options.verbose);

	const pathToProj = path.dirname(options.projFileName);
	const project = new Project(options.outputRelatedFileInfo || options.outputComboInfo);
	project.name = path.basename(options.projFileName, ".json");
	if (options.outputComboInfo) {
		project.userData.combinationInfo = [];
	}

	Promise.resolve<void>(undefined)
		.then(() => readFilePromise(options))
		.then( (data) => {
			if (data.version > 5.0) {
				return convertPromise(data, pathToProj, project, options);
			} else {
				return createConvertPromise(data, pathToProj, project, options);
			}
		})
		.then(
			(proj: Project) => {
				writeAll(proj, options.outDir, options.prefixes, options.outputRelatedFileInfo);
			}
		).catch(
			(err: any) => {
				console.log(err.stack);
			}
		);
}

export function createCellOnSkin(armature: any, skin: Skin): boolean {
	// DBs上でarmatureあたり１つしか(DBs用語の)スキンを作れないはず
	// そこでarmature.skin[0]のみ用いる
	const dbSkin = armature.skin[0];
	const dbSlots = dbSkin.slot;
	let created = false;

	for (let i = 0; i < dbSlots.length; i++) {
		const dbSlot = dbSlots[i];

		// display -> cell 変換
		for (let j = 0; j < dbSlot.display.length; j++) {
			const display = dbSlot.display[j];
			if (normalizeDisplayName(display.name) !== skin.name) {
				continue;
			}

			const cell = new Cell();

			cell.name = dbSlot.name + "_" + normalizeDisplayName(display.name);
			cell.pos.x = 0;
			cell.pos.y = 0;
			cell.size.width = skin.imageSizeW;
			cell.size.height = skin.imageSizeH;

			cell.pivot.x = -(display.transform.x || 0) / skin.imageSizeW;
			cell.pivot.y = -(display.transform.y || 0) / skin.imageSizeH;

			cell.rz = display.transform.skX || 0;

			skin.cells[cell.name] = cell;

			created = true;
		}
	}

	return created;
}

export function getBoneByName(bones: any, name: string): any {
	for (let i = 0; i < bones.length; i++) {
		if (bones[i].name === name) {
			return bones[i];
		}
	}
	return undefined;
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

		dbTransformAttributes.forEach((dbAttr: string) => {
			const dbKeyFrames: any[] = dbBoneAnime.frame;
			const curve = new AnimeParams.Curve<number>();
			curve.attribute = dbAttr2asaAttr[dbAttr];

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
				const dbBone = getBoneByName(bones, dbBoneAnime.name);
				const baseValue = dbBone.transform[dbAttr] || defaultTransformValues[dbAttr];
				const animValue = dbKeyFrame.transform[dbAttr] || defaultTransformValues[dbAttr];
				keyFrame.value = dbTransformComposeOps[dbAttr](baseValue, animValue);

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
					let ey = getBoneByName(bones, dbBoneAnime.name).transform[dbAttr] || 0;
					ey += dbKeyFrames[j + 1].transform[dbAttr] || defaultTransformValues[dbAttr];

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

				const userData: {[key: string]: string} = {};
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
		keyFrame.value = getKeyFrameAlpha(dbKeyFrame);

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
			const ey = getKeyFrameAlpha(dbKeyFrames[i + 1]);

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
			const slotDetail = getSlotDetailForBone(armature, boneName);
			keyFrame.value.cellName = slotDetail.name + "_" + normalizeDisplayName(slotDetail.display[displayIndex].name);
		} else { // 非表示
			keyFrame.value = undefined;
		}

		curve.keyFrames.push(keyFrame);
	}

	return (curve.keyFrames.length > 0) ? curve : undefined;
}

export function getSlotForBone(boneName: string, dbSlots: any[]): any {
	let dbSlot: any = undefined;

	for (let i = 0; i < dbSlots.length; i++) {
		if (dbSlots[i].parent === boneName) { // 最初に見つかったもののみ採用。ボーンに複数のスロットを持てるがサポートしない
			if (dbSlot !== undefined) { // ２つ目はサポートしていないのでエラーにする
				throw new Error("multiple slots are not supported. bone name = " + boneName);
			}
			dbSlot = dbSlots[i];
		}
	}

	return dbSlot;
}

// boneにぶら下がるスロットを探し、そのスロットのアニメーションを返す
function getSlotAnimeByBoneName(boneName: string, slotAnimes: any[], dbBones: any[], dbSlots: any[]): any {
	const dbSlot = getSlotForBone(boneName, dbSlots);

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

// display nameは部分パスを含んでいる。db2asaではnormalize後の名前を用いる
export function normalizeDisplayName(displayName: string): string {
	return path.parse(displayName).name;
}

// ボーンに配置される displayIndex番目のdisplay（画像）の名前を得る
function getDisplayImageName(armature: any, boneName: string, displayIndex: number): string {
	const slot =  getSlotDetailForBone(armature, boneName);

	if (! slot) {
		return undefined;
	}

	if (slot.display[displayIndex].type !== "image") {
		throw new Error(
			`Invalid display type(${slot.display[displayIndex].type}). ` +
			`armature name=${armature.name}, bone name=${boneName}, display index=${displayIndex}`
		);
	}

	return normalizeDisplayName(slot.display[displayIndex].name);
}

// armatureからボーンに配置されるスロット情報を得る
export function getSlotDetailForBone(armature: any, boneName: string): any {
	const skin = armature.skin[0]; // 最初のスキンのみ扱う

	const dbSlot = getSlotForBone(boneName, armature.slot);
	if (! dbSlot) {
		return undefined;
	}

	const found = skin.slot.find((slotDetail: any) => {
		return slotDetail.name === dbSlot.name;
	});

	return found;
}

//
export function getBoneIndex(bones: any, name: string): number {
	for (let i = 0; i < bones.length; i++) {
		if (bones[i].name === name) {
			return i;
		}
	}
	return -1;
}

// ボーンのZオーダーを取得する。
export function getZOrderForBone(dbSlots: any[], parentBoneName: string): number {
	// ボーンのZオーダーはボーンに紐づくスロットのZ値を用いる。
	for (let i = 0; i < dbSlots.length; i++) {
		if (dbSlots[i].parent === parentBoneName) {
			return dbSlots[i].z;
		}
	}
	return 0;
}

// キーフレームから正規化されたアルファ値を取得する。
export function getKeyFrameAlpha(dbKeyFrame: any): number {
	if (dbKeyFrame.color) {
		if (dbKeyFrame.color.aM !== undefined) {
			return dbKeyFrame.color.aM / 100;
		}
	}

	return 1.0;
}

export function createBoneSet(dbBones: any[], dbSlots: any[], name: string): BoneSet {
	const bones: Bone[] = [];

	// ASAではソート属性が与えられないかぎり、boneの並び順で描画される。
	// そこで、dbBonesをスロットのもつ優先順位の値(Z)にしたがってソートする。

	// ソート用に複製
	dbBones = [].concat(dbBones);

	// ASAではボーンあたり１つのセルしか扱えない。最初に見つかったスロットの優先順位を採用する
	for (let i = 0; i < dbBones.length; i++) {
		dbBones[i].z = getZOrderForBone(dbSlots, dbBones[i].name);
	}

	dbBones.sort((a: any, b: any): number => {
		return a.z - b.z;
	});

	for (let i = 0; i < dbBones.length; i++) {
		const dbBone = dbBones[i];
		const bone = new Bone();
		bone.name = dbBone.name;
		bone.arrayIndex = i;
		bone.parentIndex = getBoneIndex(dbBones, dbBone.parent);
		bone.parent = undefined;
		bone.children = undefined;
		bone.colliderInfos = [];
		bones.push(bone);
	}

	return new BoneSet(name, bones);
}

function writeNamedObjects<T extends { name: string }>(objs: T[], ext: string, outDir: string, version: string, prefix: string): string[] {
	const fileNames: string[] = [];
	objs.forEach((obj: T): void => {
		const json: string = JSON.stringify(new Container(version, obj));
		const fileName = prefix + obj.name + ext;
		const fullPath = path.join(outDir, fileName);
		fs.writeFileSync(fullPath, json, FS_WRITE_OPTION);
		vlog.log("write " + fullPath);
		fileNames.push(fileName);
	});
	return fileNames;
}

function writeAll(proj: Project, outDir: string, prefixes: string[], outputRelatedFileInfo: boolean): void {
	const boneSetFileNames = writeNamedObjects<BoneSet>(proj.boneSets, ".asabn", outDir, FILEFORMAT_VERSION, prefixes[Prefix.Bone]);
	const skinFileNames = writeNamedObjects<Skin>(proj.skins, ".asask", outDir, FILEFORMAT_VERSION, prefixes[Prefix.Skin]);
	const animFileNames = writeNamedObjects<AnimeParams.Animation>(
		proj.animations, ".asaan", outDir, FILEFORMAT_VERSION, prefixes[Prefix.Anim]);
	const contents: any = {
		boneSetFileNames: boneSetFileNames,
		skinFileNames: skinFileNames,
		animationFileNames: animFileNames,
		userData: proj.userData
	};

	if (outputRelatedFileInfo) {
		contents.userData.relatedFileInfo = new RelatedFileInfo(proj.imageFileNames, contents);
	}

	const con = new Container(FILEFORMAT_VERSION, contents);
	const json = JSON.stringify(con);
	const pj_fname = path.join(outDir, prefixes[Prefix.Proj] + proj.name + ".asapj");
	fs.writeFileSync(pj_fname, json, FS_WRITE_OPTION);

	vlog.log("write " + pj_fname);
}
