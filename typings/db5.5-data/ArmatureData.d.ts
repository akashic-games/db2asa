import {AnimationData} from "./AnimationData";
import * as cmnData from "./CommonData";

interface BoneData {
	// The name of the bone.
	name: string;
	// The name of the parent bone. (Optional property, default: null)
	parent?: string;
	// The custom user data. (Optional property, default: null)
	userData?: any;
	// The transform of the bone relative to the parent bone or the armature for the base pose.
	// (Optional property, default: null)
	transform?: cmnData.TransformData;
}

interface SlotData {
	// The name of the slot.
	name: string;

	// The name of the parent bone.
	parent: string;

	// The default display index of the slot. (Optional property, default: 0)
	displayIndex?: number;

	// The blend mode of the slot. (Optional property, default: null)
	blendMode?: null;

	// The custom user data. (Optional property, default: null)
	userData?: any;

	// The color transform of the slot. (Optional property, default: null)
	color?: cmnData.ColorData;
}

interface DisplayData {
	// The name of the display.
	name: string;

	// The type of the display. (Optional property, default: "image")
	// [
	//     "image: A textured rectangle,
	//     "armature: A nested child armature,
	//     "mesh: A textured mesh,
	//     "boundingBox: A bounding box
	// ]
	type?: string;

	// The resource path of the display. (Optional property, default: null)
	path?: any;

	// The name of the shared mesh. (Optional property, default: null)
	share?: string;

	// Whether to inherit the deform animations of the shared mesh. (Optional property, default: true)
	inheritDeform?: boolean;
	// The sub type of the display.
	// If the display is a bounding box: (Optional property, default: "rectangle")
	// ["rectangle: A rectangle, "ellipse: An ellipse, "polygon: A pllygon]
	subType?: string;

	// Nonessential.
	color?: number;
	// The transform of the display relative to the slot's bone. (Optional property, default: null)
	transform?: cmnData.TransformData;

	// The relative pivot of the display. (Optional property, default: null)
	pivot?: {
		x?: number; // The horizontal translate. [0.0~1.0] (Optional property, default: 0.5)
		y?: number; // The vertical translate. [0.0~1.0] (Optional property, default: 0.5)
	};

	// The size of display. (Valid for bounding box only)
	width?: number;
	height?: number;

	vertices?: number[];
	uvs?: number[];
	triangles?: number[];
	weights?: number[];
	slotPose?: number[];
	bonePose?: number[];

	// Override the default actions of the nested child armature. (Optional property, default: null)
	actions?: cmnData.ActionData[];
}

interface SkinData {
	// The name of the skin.
	name: string;

	// A list of the slots.
	slot: {
		// The name of the slot.
		name: string;

		// A list of the displays.
		display: DisplayData[];
	}[];
}

interface IkData {
	// The name of the IK constraint.
	name: string;

	// The name of the bone.
	bone: string;

	// The name of the target bone.
	target: string;

	// The IK constraint bend direction. (Optional property, default: true)
	// [true: Positive direction / Clockwise, false: Reverse Direction / Counterclockwise]
	bendPositive?: boolean;

	// The bone count of the bone chain in the constraint.
	// [0: Only the bone, N: The bone and the bone up N-level parent bones] (Optional property, default: 0)
	chain?: number;

	// The weight of the IK constraint. [0.0~1.0] (Optional property, default: 1.0)
	weight?: number;
}

export interface ArmatureData {
	// The name of the armature.
	name: string;

	// The frame rate of animations. (Optional property, default: null)
	// [null: Same as the frame rate of the DragonBones data, N: The frame rate.]
	frameRate?: number;

	// Nonessential.
	type?: string;

	// The custom user data. (Optional property, default: null)
	userData?: any;

	// A list of default actions when added to a parent armature. (Optional property, default: null)
	defaultActions?: cmnData.ActionData[];

	aabb: cmnData.Rectangle;

	// A list of the bones. (Optional property, default: null)
	bone?: BoneData[];

	// A list of the slots.
	slot: SlotData[];

	// A list of the skins.
	skin: SkinData[];

	// A list of the IK constraints.
	ik?: IkData[];

	// A list of the animations.
	animation: AnimationData[];
}
