#!/usr/bin/env node
import program = require("commander");
import C = require("./converter");

const program_version = require("../package.json").version;
const DEFAULT_PREFIXES = "pj_,bn_,sk_,an_";

program
	.version(program_version)
	.usage("[options] project_file")
	.option("-o, --out-dir <outDir>", "set output directory", "./")
	.option("-p, --add-prefix", "add prefix to each file")
	.option("-l, --long-name", "add armature name to asaan file name")
	.option("-u, --user-data", "output user data")
	.option("-c, --combination-info", "output resoruce combination info")
	.option("-r, --related-file-info", "output related file info")
	.option(
		"-P, --set-prefix <[pj],[bn],[sk],[an]>",
		"set prefixes. default: " + DEFAULT_PREFIXES,
		(list: string): string[] => {
			return list.split(",");
		}
	)
	.option("-v, --verbose", "output verbosely")
	.parse(process.argv);

if (program.args.length === 0) {
	program.outputHelp();
	process.exit(1);
} else if (program.args.length > 1) {
	console.log("too many files");
	process.exit(1);
}

const prefixes = createPrefixFromParam((<any>program).setPrefix, (<any>program).addPrefix);

if (prefixes.length < DEFAULT_PREFIXES.split(",").length) {
	console.log("Error: too few prefixes");
	process.exit(1);
}

const options: C.Options = {
	projFileName:          program.args[0],
	outDir:                <string>((<any>program).outDir),
	verbose:               !!(<any>program).verbose,
	prefixes:              prefixes,

	asaanLongName:         !!(<any>program).longName,
	outputUserData:        !!(<any>program).userData,
	outputComboInfo:       !!(<any>program).combinationInfo,
	outputRelatedFileInfo: !!(<any>program).relatedFileInfo
};

//
// Convert
//
C.convert(options);

function createPrefixFromParam(param: any, isPrefixed: boolean): string[] {
	if (Array.isArray(param)) {
		return param;
	} else if (isPrefixed === true) {
		return DEFAULT_PREFIXES.split(",");
	} else {
		return ["", "", "", ""];
	}
}
