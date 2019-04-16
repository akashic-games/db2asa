const g = require("@akashic/akashic-engine");
(<any>global).g = g;
import { Skin, BoneSet, Container, AnimeParams } from "@akashic-extension/akashic-animation";
import * as path from "path";
import * as fs from "fs-extra";
import * as U from "./Utils";
import {createConvertPromise as convertPromiseV5Lower } from "./converterV5Lower";
import {convertPromise as convertPromiseForV55} from "./converterForV55";

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
				return convertPromiseForV55(data, pathToProj, project, options);
			} else {
				return convertPromiseV5Lower(data, pathToProj, project, options);
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
