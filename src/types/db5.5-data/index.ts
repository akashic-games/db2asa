import { ArmatureData, BoneData, cmnData} from "./ArmatureData";
export { ArmatureData, BoneData, cmnData};


// DragonBones Data Version5.5
// @see: https://github.com/DragonBones/Tools/blob/master/doc/dragonbones_json_format_5.5.md
export interface DragonBonesData5_5 {
	// The name of the DragonBones data.
	name: string;

	// The version of the DragonBones data.
	version: string;

	// The minimum compatible version of the DragonBones data.
	compatibleVersion?: string;

	// The frame rate of animations. (Optional property, default: 24)
	frameRate?: number;

	// The custom user data. (Optional property, default: null)
	userData?: any;

	// A list of the armatures. (Optional property, default: null)
	armature?: ArmatureData[];
}

