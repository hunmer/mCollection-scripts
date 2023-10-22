import json
import sys
import scenedetect
from scenedetect.detectors import ContentDetector
from scenedetect.video_splitter import split_video_ffmpeg
from scenedetect.scene_manager import save_images

def print_json(data):
    print(json.dumps(data))

def on_new_scene(frame_img, frame_num):
    print_json({'type': 'new_scene', 'data': frame_num})
    
video_path = sys.argv[1]
print_json({'type': 'start', 'data': video_path})
threshold = 30
video = scenedetect.open_video(video_path)
manager = scenedetect.SceneManager()
manager.add_detector(ContentDetector(threshold=threshold))
manager.detect_scenes(video, show_progress=False, callback = on_new_scene)
scene_list = manager.get_scene_list()
# scenedetect.video_splitter.FFMPEG_PATH = 'C:\\bins\\ffmpeg'
# split_video_ffmpeg(video_path, scene_list, show_progress=True)
#save_images(scene_list, video, num_images=3, frame_margin=1, image_extension='jpg', encoder_param=95, image_name_template='$VIDEO_NAME-Scene-$SCENE_NUMBER-$IMAGE_NUMBER', output_dir="I:\\software\\mLauncher\\resources\\app\\mCollection\\scripts\\aa\\")
data = []
for i, scene in enumerate(scene_list):
    data.append({
        'start': {'time': scene[0].get_timecode(), 'frame': scene[0].get_frames()},
        'end': {'time': scene[1].get_timecode(), 'frame': scene[1].get_frames()},
    })
print_json({'type': 'list_scenes', 'data': data})