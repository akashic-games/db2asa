"use strict"

const U = require("../lib/Utils.js");

describe("Utils", function() {
    describe("Logger", function() {
        it("can construct itself with parameter false", function() {
            expect(function(){ new U.Logger(false); }).not.toThrow();
            expect(new U.Logger(false)).toBeDefined();
            expect((new U.Logger(false)).log).toBeDefined();
        });

        it("can construct itself with parameter true", function() {
            expect(function() { new U.Logger(true); }).not.toThrow();
            expect(new U.Logger(true)).toBeDefined();
            expect((new U.Logger(true)).log).toBeDefined();
        });

        it("doesn't throw exception while logging message", function() {
            expect(function(){ (new U.Logger(false)).log("foo"); }).not.toThrow();
            expect(function(){ (new U.Logger(true)).log("bar"); }).not.toThrow();
        });
    });
});
