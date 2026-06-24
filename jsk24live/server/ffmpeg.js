const { spawn, execFile } = require('child_process');
const path = require('path');

const FFMPEG = process.env.FFMPEG_PATH || 'ffmpeg';
const FFPROBE = process.env.FFPROBE_PATH || 'ffprobe';

const QUALITY_PRESETS = {
  copy: { label: 'Copy (no transcode, lowest CPU)' },
  '360p': { label: '360p (800 kbps)', w: 640, h: 360, vb: '800k', maxrate: '800k', bufsize: '1600k', fps: 30 },
  '480p': { label: '480p (1200 kbps)', w: 854, h: 480, vb: '1200k', maxrate: '1200k', bufsize: '2400k', fps: 30 },
  '720p': { label: '720p (2500 kbps)', w: 1280, h: 720, vb: '2500k', maxrate: '2500k', bufsize: '5000k', fps: 30 },
  '1080p': { label: '1080p (4500 kbps)', w: 1920, h: 1080, vb: '4500k', maxrate: '4500k', bufsize: '9000k', fps: 30 },
};

function probe(filePath) {
  return new Promise((resolve) => {
    execFile(
      FFPROBE,
      [
        '-v',
        'error',
        '-select_streams',
        'v:0',
        '-show_entries',
        'stream=width,height : format=duration',
        '-of',
        'json',
        filePath,
      ],
      { timeout: 15000 },
      (err, stdout) => {
        if (err) return resolve({ duration: null, width: null, height: null });
        try {
          const j = JSON.parse(stdout);
          const s = (j.streams && j.streams[0]) || {};
          const f = j.format || {};
          resolve({
            duration: f.duration ? parseFloat(f.duration) : null,
            width: s.width || null,
            height: s.height || null,
          });
        } catch (_) {
          resolve({ duration: null, width: null, height: null });
        }
      }
    );
  });
}

function buildArgs({ playlistFile, quality, rtmpUrl, streamKey }) {
  const preset = QUALITY_PRESETS[quality] || QUALITY_PRESETS.copy;
  const target = rtmpUrl.replace(/\/+$/, '') + '/' + streamKey;

  const args = [
    '-hide_banner',
    '-loglevel', 'info',
    '-re',
    '-stream_loop', '-1',
    '-f', 'concat',
    '-safe', '0',
    '-i', playlistFile,
  ];

  if (quality === 'copy') {
    args.push('-c', 'copy', '-bsf:a', 'aac_adtstoasc');
  } else {
    args.push(
      '-c:v', 'libx264',
      '-preset', 'veryfast',
      '-tune', 'zerolatency',
      '-pix_fmt', 'yuv420p',
      '-b:v', preset.vb,
      '-maxrate', preset.maxrate,
      '-bufsize', preset.bufsize,
      '-vf', `scale=${preset.w}:${preset.h}:force_original_aspect_ratio=decrease,pad=${preset.w}:${preset.h}:(ow-iw)/2:(oh-ih)/2`,
      '-r', String(preset.fps),
      '-g', String(preset.fps * 2),
      '-c:a', 'aac',
      '-b:a', '128k',
      '-ar', '44100',
      '-ac', '2'
    );
  }

  args.push('-f', 'flv', target);
  return args;
}

module.exports = { FFMPEG, FFPROBE, QUALITY_PRESETS, probe, buildArgs, spawn };
