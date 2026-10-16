<?php
$root = realpath('/source/src');
$files = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($root));
$count = 0;
foreach ($files as $file) {
    if ($file->isFile() && $file->getExtension() === 'php') {
        passthru(escapeshellarg(PHP_BINARY) . ' -l ' . escapeshellarg($file->getPathname()), $exitCode);
        if ($exitCode !== 0) { exit($exitCode); }
        $count++;
    }
}
echo "PHP lint: $count files passed.\n";
