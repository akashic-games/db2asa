import { Skin, Bone, BoneSet, Cell } from "@akashic-extension/akashic-animation";
import * as path from "path";

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

// display nameは部分パスを含んでいる。db2asaではnormalize後の名前を用いる
export function normalizeDisplayName(displayName: string): string {
	return path.parse(displayName).name;
}

// armatureからボーンに配置されるスロット情報を得る
export function getSlotDetailForBone(armature: any, boneName: string): any {
	const skin = armature.skin[0]; // 最初のスキンのみ扱う

	const dbSlot = getSlotForBone(boneName, armature.slot);
	if (!dbSlot) {
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
