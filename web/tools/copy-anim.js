import fs from "fs";
import path from "path";

const sourceBase = "E:\\hack\\ns\\Pokemon Scarlet\\pokemon\\data";
const targetBase = "..\\assets\\SCVI";

function copyFiles(srcDir, destDir, extensions) {
  if (!fs.existsSync(srcDir)) {
    console.log(`Source directory ${srcDir} does not exist.`);
    return;
  }

  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }

  const items = fs.readdirSync(srcDir);
  items.forEach((item) => {
    const srcPath = path.join(srcDir, item);
    const stat = fs.statSync(srcPath);

    if (stat.isDirectory()) {
      copyFiles(srcPath, destDir, extensions);
    } else if (stat.isFile() && extensions.some((ext) => item.endsWith(ext))) {
      const destPath = path.join(destDir, item);
      fs.copyFileSync(srcPath, destPath);
      console.log(`Copied ${srcPath} to ${destPath}`);
    }
  });
}

function main() {
  const pokemonDirs = fs.readdirSync(targetBase).filter((dir) => {
    return (
      fs.statSync(path.join(targetBase, dir)).isDirectory() &&
      dir.startsWith("pm")
    );
  });

  pokemonDirs.forEach((dir) => {
    const srcDir = path.join(sourceBase, dir);
    if (!fs.existsSync(srcDir)) {
      console.log(`Source directory ${srcDir} does not exist.`);
      return;
    }
    const subDirs = fs.readdirSync(srcDir).filter((sub) => {
      return (
        fs.statSync(path.join(srcDir, sub)).isDirectory() &&
        sub.match(/^pm\d{4}_\d{2}_\d{2}$/)
      );
    });
    subDirs.forEach((sub) => {
      const subSrcDir = path.join(srcDir, sub);
      const subDestDir = path.join(targetBase, dir, sub);
      copyFiles(subSrcDir, subDestDir, [".tranm", ".tracm"]);
    });
  });
}

main();
