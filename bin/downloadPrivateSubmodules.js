/**
 * Copyright (c) 2018 Uncharted Software Inc.
 * http://www.uncharted.software/
 */

const packageJson = require('../package.json');
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const fileTools = require('./fileTools.js');
const targz = require('targz');
const mv = require('mv');

const NPM_PUBLIC_REGISTRY = 'https://registry.npmjs.org/';

/**
 * Analyzes the given URL and returns the proper protocol object to request the URL.
 *
 * @method getProtocolFromURL
 * @param {String} url - The URL from which the protocol should be extracted.
 * @returns {*}
 */
function getProtocolFromURL(url) {
    let protocol = null;
    const components = url.split('//');
    if (components[0] === 'http:') {
        protocol = http;
    } else if (components[0] === 'https:') {
        protocol = https;
    }
    return protocol;
}

/**
 * Download the file at the given URL to the given location. It calls the callback when done or if an error occurs.
 *
 * @method downloadFile
 * @param {String} url - The URL of the file to download.
 * @param {String} dest - The local file to which the file will be downloaded.
 * @param {Function} callback - Callback function that will be called once the process is finished.
 */
function downloadFile(url, dest, callback) {
    try {
        fileTools.createFilePath(dest);
        const file = fs.createWriteStream(dest);

        let protocol = getProtocolFromURL(url);

        const request = protocol.get(url, function (response) {
            response.pipe(file);
            file.on('finish', function () {
                file.close(callback);
            });
        }).on('error', function (err) {
            fs.unlink(dest, () => {
                if (callback) {
                    callback(err.message);
                }
            });
        });
    }
    catch (err) {
        console.log(err);
    }
}

/**
 * Finds the version of the module at the given path, if it exists.
 *
 * @method findModuleVersion
 * @param {String} modulePath - The path to the module to find the version of.
 * @returns {*}
 */
function findModuleVersion(modulePath) {
    let packagePath = path.join(modulePath, 'package.json');
    if (fileTools.pathExists(packagePath)) {
        const moduleInfo = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
        if (moduleInfo && moduleInfo.version) {
            return moduleInfo.version;
        }
    }

    return null;
}

/**
 * Retrieves the registries active in the current environment.
 *
 * @method retrieveRegistries
 * @returns {string[]}
 */
function retrieveRegistries() {
    const registries = [NPM_PUBLIC_REGISTRY];
    const registryRegex = new RegExp('registry');
    for (let key in process.env) {
        if (process.env.hasOwnProperty(key)) {
            if (registryRegex.test(key) && registries.indexOf(process.env[key]) === -1) {
                registries.push(process.env[key]);
            }
        }
    }
    return registries;
}

/**
 * Retrieves the package info at the given URL.
 *
 * @method hitRegistryForInfo
 * @param {String} url - The url where the package info is located
 * @param {Object} protocol - The protocol that will be used to hit the URL.
 * @param {Function} callback - Function to be called when the process is done.
 */
function hitRegistryForInfo(url, protocol, callback) {
    let buffer = '';
    protocol.get(url, function (res) {
        res.on('data', function (data) {
            buffer += data;
        });

        res.on('end', function () {
            callback(buffer);
        });
    })
}

/**
 * Tries to get the information of the given module from the available registries.
 *
 * @method getModuleInfo
 * @param {Array} registries - An array of registry URLs
 * @param {String} name - The name of the module.
 * @param {String} version - The version of the module.
 * @param {Function} callback - Function to be called when the process is done.
 */
function getModuleInfo(registries, name, version, callback) {
    version = version || 'latest';

    const registriesCopy = registries.slice(0);
    const retrieveInfo = function (data) {
        if (data) {
            try {
                const info = JSON.parse(data);
                if (info.versions[version].dist.tarball) {
                    setTimeout(callback.bind(this, info.versions[version]));
                    return;
                }
            } catch (error) {
            }
        }

        if (registriesCopy.length) {
            let registry = registriesCopy.pop();
            if (registry.slice(-1) !== '/') {
                registry += '/';
            }

            let protocol = getProtocolFromURL(registry);
            if (!protocol) {
                setTimeout(retrieveInfo.bind(this, null));
                return;
            }

            const url = registry + name.replace('/', '%2F');
            hitRegistryForInfo(url, protocol, retrieveInfo);
        } else {
            callback(null);
        }
    };

    retrieveInfo(null);
}

/**
 * Script's main function.
 *
 * @method main
 */
function main() {
    process.on('exit', function () {
        // console.log('delete tmp_submodules');
        fileTools.deleteFolder('./tmp_submodules/');
    });

    const submodules = packageJson.privateSubmodules;
    if (submodules) {
        const registries = retrieveRegistries();
        for (let submoduleName in submodules) {
            if (submodules.hasOwnProperty(submoduleName)) {
                const tmpPath = path.join('./tmp_submodules/', submoduleName);
                const modulePath = path.join('./lib/', submoduleName);

                const currentVersion = findModuleVersion(modulePath);
                const desiredVersion = submodules[submoduleName];
                if (currentVersion === desiredVersion) {
                    console.info(submoduleName + ' v.' + desiredVersion + ' already installed.');
                    continue;
                } else if (currentVersion) {
                    fileTools.deleteFolder(modulePath);
                }

                getModuleInfo(registries, submoduleName, desiredVersion, function (info) {
                    if (info && info.version === desiredVersion) {
                        const tarballPath = path.join(tmpPath, 'module.tgz');
                        downloadFile(info.dist.tarball, tarballPath, function (error) {
                            if (error) {
                                console.error(error);
                            } else {
                                const extract = targz.decompress({
                                    src: tarballPath,
                                    dest: tmpPath,
                                }, function(err) {
                                    if (err) {
                                        console.error(err);
                                    } else {
                                        try {
                                            fileTools.createFilePath(modulePath);
                                            mv(path.join(tmpPath, 'package'), modulePath, function (err) {
                                                if (err) {
                                                    console.error(err);
                                                }
                                            });
                                        }
                                        catch (err) {
                                            console.log(err);
                                        }
                                    }
                                });
                            }
                        });
                    }
                });
            }
        }
    }
}

// run the script
main();
