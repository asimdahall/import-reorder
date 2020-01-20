const fs = require("fs");
const path = require("path");

const isDirectory = path => {
  try {
    var stat = fs.lstatSync(path);
    return stat.isDirectory();
  } catch (e) {
    console.log(e, "Something went wrong while getting file extension");
  }
};

const globalDirectories = ["utils", "api", "consts", "assets"];

const ifJavascriptFile = filePath =>
  path.extname(filePath).toLowerCase() === ".js";

const matchStringWithPattern = (regex, data) => data.match(regex);

const getFileContent = filePath => {
  try {
    const data = fs.readFileSync(filePath, {
      encoding: "utf8"
    });
    return data;
  } catch (e) {
    console.log("There was an error while reading the file" + filePath, e);
  }
};

const formatExternalImports = imports =>
  imports
    .sort((first, second) => first.imp.length - second.imp.length)
    .map(({ imp }) => imp);

const formatGlobalImports = imports => {
  if (imports.length) {
    const classifiedGlobalImports = globalDirectories.reduce(
      (acc, directory) => {
        const filteredImports =
          imports
            .filter(({ currentPath }) => currentPath.includes(directory))
            .sort((a, b) => a.imp.length - b.imp.length)
            .map(({ imp }) => imp) || [];

        return { ...acc, [directory]: filteredImports };
      },
      {}
    );
    return (
      Array.from(new Set(Object.values(classifiedGlobalImports).flat())) || []
    );
  }
  return [];
};

const formatLocalImports = imports => {
  if (imports.length > 0) {
    const orderedWithPath = imports.reduce((acc, { currentPath, imp }) => {
      const numberOfSlashes = currentPath.match(/[/]+/g).length;
      const data = acc[numberOfSlashes] || [];
      return {
        ...acc,
        [numberOfSlashes]: [...data, { currentPath, imp }]
      };
    }, {});

    return Object.values(orderedWithPath)
      .map(toBeSortedArray => {
        return toBeSortedArray
          .sort((a, b) => {
            return a.imp.localeCompare(b.imp, "en", {
              sensitivity: "base"
            });
          })
          .map(({ imp }) => imp);
      })
      .flat();
  }
  return [];
};

const isRelative = path => path.includes("../") || path.includes("./");

const isNotSibling = path => path.includes("../");

const isGlobal = path =>
  globalDirectories.some(directory => path.includes(directory));

const getClassifiedImports = imports => {
  let externalImports = [];
  let globalImports = [];
  let siblingImports = [];
  let relativeImports = [];

  imports.forEach(imp => {
    const importPath = matchStringWithPattern(/"(.*?)"/g, imp) || [];
    const [currentPath = ""] = importPath;
    if (isRelative(currentPath)) {
      if (isGlobal(currentPath)) {
        globalImports = [...globalImports, { imp, currentPath }];
      } else if (isNotSibling(currentPath)) {
        relativeImports = [...relativeImports, { imp, currentPath }];
      } else {
        siblingImports = [...siblingImports, { imp, currentPath }];
      }
    } else {
      externalImports = [...externalImports, { imp, currentPath }];
    }
  });
  const formattedGlobalImports = formatGlobalImports(globalImports);
  const formattedExternalImports = formatExternalImports(externalImports);
  const formattedSiblingImports = formatLocalImports(siblingImports);
  const formarttedRelativeImports = formatLocalImports(relativeImports);

  return [
    formattedExternalImports,
    formattedGlobalImports,
    formarttedRelativeImports,
    formattedSiblingImports
  ];
};

const writeFile = (path, content) => {
  fs.writeFile(path, content, err => {
    if (err) throw err;
    console.log(`The file ${path} has been reordered!`);
  });
};

const searchRecursively = dir =>
  fs.readdir(dir, (err, files) => {
    if (err) {
      console.log(err);
    } else {
      files.forEach(file => {
        const filePath = path.join(dir, file);
        if (isDirectory(filePath)) {
          searchRecursively(filePath);
        } else {
          if (ifJavascriptFile(filePath)) {
            const fileContent = getFileContent(filePath);
            const imports =
              matchStringWithPattern(/import(.*?);\n/g, fileContent) || [];
            const [
              externalImports,
              globalImports,
              siblingImports,
              relativeImports
            ] = getClassifiedImports(imports || []);

            const lastImportStatement = imports[imports.length - 1] || "";
            const indexToReplaceAt =
              fileContent.indexOf(lastImportStatement) +
              lastImportStatement.length;
            const orderedImports = [
              externalImports,
              globalImports,
              siblingImports,
              relativeImports
            ].flat();
            const lastElement = orderedImports[orderedImports.length - 1] || "";
            const orderedImportsString = orderedImports.join("");
            const index = orderedImportsString.indexOf(lastElement);
            if (index > 0) {
              const updatedFile =
                orderedImportsString + fileContent.substr(indexToReplaceAt);
              writeFile(filePath, updatedFile);
            }
          }
        }
      });
    }
  });

searchRecursively(path.join(__dirname, "test"));
