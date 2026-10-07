var gulp = require("gulp");
var del = require("del");
var tslint = require("gulp-tslint");
var jasmine = require("gulp-jasmine");
var istanbul = require("gulp-istanbul");
var shell = require("gulp-shell");
var reporters = require("jasmine-reporters");
var Reporter = require("jasmine-terminal-reporter");

gulp.task("clean", function(cb) { del("lib", cb); });
gulp.task("clean:typings", function (cb) { del("typings", cb); });

gulp.task("install:typings", shell.task("typings install"));

gulp.task("compile", shell.task("tsc -p ./"));

gulp.task("lint", function() {
	return gulp
		.src("./src/**/*.ts")
		.pipe(tslint())
		.pipe(tslint.report('prose', {
			summarizeFailureOutput: true
		}
	));
});

gulp.task("lint-md", function(){
	return gulp.src(["**/*.md", "!node_modules/**/*.md"])
		.pipe(shell(["mdast <%= file.path %> --frail --no-stdout --quiet"]));
});

gulp.task("test", gulp.series("compile", function (cb) {
	var jasmineReporters = [
		new Reporter({
			isVerbose: false,
			showColors: true,
			includeStackTrace: false
		}),
		new reporters.JUnitXmlReporter()
	];
	return gulp.src(["./lib/**/*.js"])
		.pipe(istanbul())
		.pipe(istanbul.hookRequire())
		.on("finish", function() {
			gulp.src("spec/**/*[sS]pec.js")
				.pipe(jasmine({ reporter: jasmineReporters }))
				.pipe(istanbul.writeReports({ reporters: ["text", "cobertura", "lcov"] }))
				.on("end", cb);
		});
}));

gulp.task("default", gulp.series("compile"));
