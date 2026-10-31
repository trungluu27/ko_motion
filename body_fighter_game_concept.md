# BODY FIGHTER – Motion-Controlled Martial Arts Game

> **Game Concept Document – Version 1.0**  
> **Thể loại:** 2D Single-Player Fighting Game  
> **Điều khiển:** Webcam + MediaPipe Pose (toàn thân)  
> **Đối thủ:** AI-controlled NPC  
> **Tên dự án:** BODY FIGHTER (tên tạm thời)

---

## 1. Tổng quan dự án

### 1.1. Ý tưởng cốt lõi

BODY FIGHTER là game đối kháng võ thuật 2D dành cho một người chơi. Người chơi sử dụng webcam để điều khiển nhân vật bằng chính chuyển động cơ thể ngoài đời thực, thay vì phụ thuộc vào bàn phím hoặc tay cầm.

Hệ thống sử dụng MediaPipe để theo dõi tư thế và chuyển động toàn thân, phân tích các hành động như đấm, đá, né, phòng thủ, cúi người và nhảy. Những chuyển động này được chuyển thành lệnh điều khiển nhân vật trong game.

Người chơi chiến đấu với các đối thủ do máy điều khiển (AI NPC), vượt qua các màn chơi, mở khóa kỹ năng và đối đầu với những boss có phong cách chiến đấu khác nhau.

### 1.2. Mục tiêu sản phẩm

- Tạo trải nghiệm chơi game kết hợp vận động thể chất.
- Khai thác Computer Vision để biến cơ thể thành thiết bị điều khiển.
- Xây dựng hệ thống chiến đấu có phản hồi trực quan và độ trễ thấp.
- Tạo AI đối thủ có khả năng tấn công, phòng thủ, né tránh và phản công.
- Phát triển một sản phẩm giải trí có thể mở rộng sang luyện tập thể chất hoặc trình diễn công nghệ AI.

### 1.3. Định hướng sản phẩm

Trọng tâm của game không chỉ là nhận diện cử chỉ, mà là tạo cảm giác người chơi đang trực tiếp điều khiển một võ sĩ. Chất lượng nhận diện chuyển động, độ phản hồi của combat và hành vi của NPC là ba yếu tố quan trọng nhất.

---

## 2. Phong cách đồ họa và gameplay

| Hạng mục | Định hướng |
|---|---|
| Góc nhìn | 2D side-view / side-scrolling |
| Camera | Góc nhìn ngang, theo dõi khu vực chiến đấu |
| Nhân vật | Sprite 2D có animation |
| Phong cách hình ảnh | Võ thuật hiện đại kết hợp anime |
| Gameplay | Real-time combat |
| Chế độ | Single Player |
| Điều khiển | Webcam + MediaPipe |
| Đối thủ | AI NPC |

### 2.1. Định hướng hình ảnh

- Nhân vật có tạo hình rõ ràng, dễ phân biệt tư thế và động tác.
- Animation võ thuật mượt, có anticipation, impact và recovery.
- Hiệu ứng đòn đánh sinh động nhưng không che khuất nhân vật.
- Đấu trường có thể gồm võ đường, sàn đấu, khu phố hoặc đấu trường boss.
- Giao diện hiển thị HP, stamina, combo, năng lượng đặc biệt và thời gian trận đấu.

### 2.2. Trải nghiệm gameplay

Người chơi đứng trước webcam, thực hiện các động tác võ thuật ngoài đời thực. Nhân vật trên màn hình phản hồi bằng các animation tương ứng. NPC tự động di chuyển, tấn công, phòng thủ và phản công để tạo thành trận đấu đối kháng.

---

## 3. Hệ thống điều khiển toàn thân

Đây là thành phần cốt lõi và là điểm khác biệt lớn nhất của dự án.

Người chơi đứng trước webcam. MediaPipe Pose theo dõi các điểm khớp cơ thể (landmarks), sau đó hệ thống phân tích tư thế và chuỗi chuyển động để nhận diện hành động.

### 3.1. Mapping chuyển động

| Chuyển động thực tế | Hành động trong game |
|---|---|
| Đấm tay trái | Left Punch |
| Đấm tay phải | Right Punch |
| Đấm liên tiếp hai tay | Double Punch |
| Đá chân trái | Left Kick |
| Đá chân phải | Right Kick |
| Đưa hai tay lên bảo vệ mặt | Block |
| Hạ thấp trọng tâm | Crouch |
| Nghiêng thân sang trái | Dodge Left |
| Nghiêng thân sang phải | Dodge Right |
| Nhún người và bật lên | Jump |
| Bước hoặc dịch chuyển thân sang trái | Move Left |
| Bước hoặc dịch chuyển thân sang phải | Move Right |

**Lưu ý về nhận diện:** Di chuyển trái/phải nên kết hợp vị trí thân và chân, không chỉ dựa vào việc nghiêng người. Jump và Kick cần được nhận diện theo chuỗi chuyển động để tránh kích hoạt nhầm.

### 3.2. Phương pháp nhận diện chuyển động

Không nên chỉ dựa vào vị trí landmark tại một thời điểm. Hệ thống cần phân tích:

- Vị trí các khớp cơ thể.
- Góc giữa các khớp.
- Vận tốc và gia tốc chuyển động.
- Hướng di chuyển của tay, chân và thân.
- Thời gian duy trì một tư thế.
- Chuỗi hành động liên tiếp theo thời gian.

**Ví dụ nhận diện cú đấm:**

1. Theo dõi vai, khuỷu tay và cổ tay.
2. Xác định cánh tay bắt đầu duỗi về phía trước.
3. Đo vận tốc duỗi của cánh tay.
4. Xác định thời điểm đạt ngưỡng chuyển động.
5. Phát sự kiện `left_punch` hoặc `right_punch`.
6. Theo dõi giai đoạn thu tay về để xác định kết thúc động tác và cho phép nhận diện cú tiếp theo.

### 3.3. Calibration – Hiệu chỉnh theo người chơi

Trước khi chơi, người dùng thực hiện bước hiệu chỉnh:

1. Đứng ở vị trí phù hợp trước webcam.
2. Đưa toàn thân vào vùng camera.
3. Thực hiện một số tư thế và động tác mẫu.
4. Hệ thống xác định tỷ lệ cơ thể, tư thế trung lập và phạm vi chuyển động.
5. Điều chỉnh ngưỡng nhận diện theo từng người chơi.

Calibration giúp hệ thống hoạt động ổn định hơn với người có vóc dáng và khoảng cách camera khác nhau.

### 3.4. Trạng thái nhận diện

Giao diện Calibration nên hiển thị:

- Đang tìm người chơi.
- Chưa nhìn thấy toàn thân.
- Cơ thể nằm ngoài vùng camera.
- Đang hiệu chỉnh.
- Nhận diện thành công.
- Sẵn sàng chiến đấu.

---

## 4. Hệ thống chiến đấu (Combat System)

### 4.1. Thuộc tính nhân vật

| Thuộc tính | Mô tả |
|---|---|
| HP | Lượng máu, giảm khi nhận sát thương |
| Stamina | Thể lực, tiêu hao khi thực hiện hành động |
| Attack | Sức tấn công |
| Defense | Khả năng phòng thủ |
| Speed | Tốc độ ra đòn và hồi phục |
| Special Energy | Năng lượng dùng cho kỹ năng đặc biệt |

### 4.2. Thông tin của mỗi đòn đánh

Mỗi hành động chiến đấu nên có:

- Animation tương ứng.
- Thời gian thực hiện.
- Sát thương cơ bản.
- Phạm vi và vùng va chạm.
- Thời gian hồi chiêu hoặc chi phí stamina.
- Khả năng bị đối thủ né, đỡ hoặc phản đòn.
- Các giai đoạn startup, active và recovery.

### 4.3. Combo System

Người chơi có thể kết hợp nhiều chuyển động để kích hoạt combo.

| Chuỗi động tác | Combo gợi ý |
|---|---|
| Đấm trái → Đấm phải | Double Jab |
| Đấm trái → Đấm phải → Đá phải | Triple Attack |
| Đỡ → Né → Đấm phải | Counter Attack |
| Đấm phải → Đá trái → Đá phải | Power Combo |

Combo cần được nhận diện theo đúng thứ tự và trong một khoảng thời gian cho phép. Nên có cửa sổ thời gian (combo window), quy tắc hủy đòn (cancel rules) và phản hồi trực quan để người chơi hiểu khi nào combo thành công.

### 4.4. Hit Detection

Khi hai nhân vật giao chiến, hệ thống cần kiểm tra:

- Khoảng cách giữa hai nhân vật.
- Hướng tấn công.
- Thời điểm ra đòn.
- Trạng thái phòng thủ của đối thủ.
- Hitbox và hurtbox của từng nhân vật.

Nếu đòn đánh trúng, đối thủ mất HP và kích hoạt animation bị đánh, hiệu ứng va chạm và âm thanh. Không nên dựa trực tiếp vào khoảng cách webcam để tính va chạm trong game; combat được xử lý trong không gian 2D của game engine.

---

## 5. AI đối thủ (NPC)

Đối thủ được điều khiển bởi AI, không cần MediaPipe. AI có nhiệm vụ tạo ra trận đấu thử thách và phản ứng phù hợp với hành động của người chơi.

### 5.1. Các hành vi của NPC

| Hành vi | Mô tả |
|---|---|
| Idle | Đứng trong tư thế chiến đấu |
| Approach | Tiến lại gần người chơi |
| Attack | Chủ động tấn công |
| Block | Phòng thủ |
| Dodge | Né tránh |
| Counter | Phản công khi người chơi sơ hở |
| Retreat | Lùi lại để tạo khoảng cách |
| Special Attack | Sử dụng kỹ năng đặc biệt |

### 5.2. Các cấp độ AI

- **Easy:** Tấn công đơn giản, ít phòng thủ, có nhiều khoảng nghỉ.
- **Normal:** Biết kết hợp đòn đánh, phòng thủ và né tránh.
- **Hard:** Biết phản công, thay đổi chiến thuật và tận dụng sơ hở.
- **Boss:** Có bộ kỹ năng riêng, nhiều giai đoạn chiến đấu và các đòn đánh đặc biệt.

### 5.3. Adaptive AI – Đối thủ thích nghi

NPC có thể ghi nhận thói quen chiến đấu của người chơi và điều chỉnh chiến thuật.

Ví dụ:

- Người chơi thường xuyên đấm tay phải → NPC tăng tỷ lệ phòng thủ trước các đòn đấm.
- Người chơi thường xuyên đá → NPC chủ động giữ khoảng cách hoặc né.
- Người chơi thường xuyên phòng thủ → NPC tăng tần suất sử dụng đòn phá phòng thủ.
- Người chơi liên tục tấn công → NPC tận dụng thời gian hồi chiêu để phản công.

Trong phiên bản đầu tiên, chỉ cần sử dụng bộ quy tắc và thống kê hành vi. Chưa cần Machine Learning phức tạp.

### 5.4. Công nghệ AI NPC

Sử dụng Finite State Machine (FSM) hoặc Behavior Tree để quản lý hành vi. FSM phù hợp để bắt đầu vì dễ triển khai và kiểm thử; Behavior Tree có thể được cân nhắc khi hành vi NPC phức tạp hơn.

---

## 6. Game Modes và hệ thống màn chơi

### 6.1. Các chế độ chơi

| Chế độ | Mô tả | Phạm vi MVP |
|---|---|---|
| Quick Fight | Đấu nhanh với một NPC | Có |
| Training Mode | Luyện tập và học động tác | Có |
| Story Mode | Vượt qua các đối thủ theo cốt truyện | Chưa |
| Survival Mode | Đánh liên tục nhiều đối thủ | Chưa |
| Boss Fight | Đối đầu với boss mạnh | Mở rộng |

MVP chỉ cần triển khai Quick Fight và Training Mode.

### 6.2. Hệ thống nhân vật và võ phái

Mỗi nhân vật có phong cách chiến đấu riêng:

- **Boxer:** Tập trung vào đấm và combo tay.
- **Karate:** Kết hợp đấm, đá và phản công.
- **Taekwondo:** Tập trung vào các đòn đá.
- **Kung Fu:** Kết hợp đấm, đá, né và phản đòn.

Ban đầu chỉ cần một nhân vật người chơi và một NPC. Các nhân vật khác được bổ sung sau khi hệ thống chiến đấu ổn định.

### 6.3. Progression System

Trong các phiên bản mở rộng, người chơi có thể:

- Nhận điểm sau mỗi trận đấu.
- Mở khóa kỹ năng.
- Nâng cấp sức mạnh, tốc độ và thể lực.
- Mở khóa nhân vật và trang phục.
- Mở khóa các cấp độ khó và đấu trường mới.

---

## 7. Giao diện game (UI/UX)

### 7.1. Màn hình chính

Các mục dự kiến:

- Play
- Training
- Character
- Settings
- Exit

### 7.2. Màn hình chiến đấu

Các thành phần giao diện:

1. Thanh HP người chơi.
2. Thanh HP đối thủ.
3. Thanh Stamina.
4. Thanh Special Energy.
5. Bộ đếm thời gian trận đấu.
6. Combo Counter.
7. Thông báo khi đánh trúng, bị đánh hoặc đỡ thành công.

### 7.3. Màn hình Calibration

Hiển thị hình ảnh webcam và bộ khung xương MediaPipe để người chơi biết hệ thống đang nhận diện cơ thể như thế nào.

Nên có hướng dẫn vị trí đứng, khoảng cách camera và trạng thái nhận diện. Người chơi chỉ được bắt đầu trận đấu khi toàn thân được nhìn thấy và tracking đủ ổn định.

---

## 8. Kiến trúc kỹ thuật

### 8.1. Nguyên tắc kiến trúc

Tách biệt xử lý chuyển động và game engine thành hai thành phần độc lập:

- **Motion Recognition Service:** Nhận hình ảnh webcam, chạy MediaPipe, phân tích chuyển động và phát sự kiện điều khiển.
- **Game Application:** Nhận sự kiện, điều khiển nhân vật, xử lý combat, AI NPC, animation và giao diện.

Cách tách này giúp dễ phát triển, kiểm thử và tối ưu từng phần. Không nên chạy toàn bộ quá trình nhận diện MediaPipe bên trong vòng lặp xử lý game.

### 8.2. Sơ đồ kiến trúc

```text
┌──────────────────────────┐
│       Webcam Input       │
│         OpenCV           │
└────────────┬─────────────┘
             │ Video frames
             ▼
┌──────────────────────────┐
│     Pose Estimation      │
│       MediaPipe          │
│     Body Landmarks       │
└────────────┬─────────────┘
             │ Landmarks
             ▼
┌──────────────────────────┐
│   Motion Processing      │
│ Normalize / Smooth       │
│ Angles / Velocity        │
└────────────┬─────────────┘
             │ Motion features
             ▼
┌──────────────────────────┐
│   Action Recognition     │
│ Punch / Kick / Dodge     │
│ Block / Jump / Movement  │
└────────────┬─────────────┘
             │ Game events
             ▼
┌──────────────────────────┐
│   Game Event Interface   │
│    WebSocket / TCP       │
└────────────┬─────────────┘
             │
             ▼
┌─────────────────────────────────────┐
│             Godot Game              │
│                                     │
│  ┌────────────────┐ ┌────────────┐  │
│  │ Player         │ │ NPC AI     │  │
│  │ Controller     │ │ Controller │  │
│  └────────────────┘ └────────────┘  │
│             │          │            │
│             ▼          ▼            │
│       ┌─────────────────────┐       │
│       │   Combat System     │       │
│       │ HP / Stamina        │       │
│       │ Hitbox / Combo      │       │
│       └──────────┬──────────┘       │
│                  ▼                  │
│       Animation / UI / Audio        │
└─────────────────────────────────────┘
```

### 8.3. Công nghệ đề xuất

| Thành phần | Công nghệ | Vai trò |
|---|---|---|
| Ngôn ngữ xử lý CV | Python | Motion processing |
| Camera input | OpenCV | Thu nhận webcam |
| Pose estimation | MediaPipe Pose Landmarker | Theo dõi cơ thể |
| Xử lý dữ liệu | NumPy | Phân tích landmark và chuyển động |
| Game engine | Godot | Xây dựng game 2D |
| NPC AI | FSM / Behavior Tree | Điều khiển đối thủ |
| Animation | Godot Sprite Animation | Animation nhân vật |
| Audio | Godot Audio | Âm thanh và hiệu ứng |
| Giao tiếp | WebSocket hoặc TCP local | Truyền sự kiện giữa Python và Godot |

**Lựa chọn khuyến nghị: Godot + Python + MediaPipe.**

Godot phù hợp với game 2D và có sẵn hệ thống scene, animation, physics và collision. Python xử lý MediaPipe độc lập. Hai thành phần có thể giao tiếp qua WebSocket hoặc TCP trên máy local.

### 8.4. Ví dụ dữ liệu sự kiện

Python gửi sự kiện sang Godot:

```json
{
  "action": "right_punch",
  "confidence": 0.94,
  "timestamp": 1793450000
}
```

Game engine tiếp nhận sự kiện, kiểm tra trạng thái nhân vật và quyết định có thực hiện hành động hay không.

Cần bổ sung:

- Confidence threshold để loại bỏ dự đoán thiếu chắc chắn.
- Cooldown và Action State để tránh một động tác bị kích hoạt nhiều lần.
- Smoothing để giảm nhiễu landmark.
- Timestamp hoặc sequence ID để xử lý thứ tự sự kiện.
- Cơ chế phát hiện mất tracking và ngừng nhận lệnh khi không nhìn thấy người chơi.

---

## 9. Kế hoạch triển khai MVP

Mục tiêu là tạo ra phiên bản có thể chơi được trước, chưa cần xây dựng toàn bộ nhân vật, cốt truyện hoặc hệ thống progression.

| Giai đoạn | Công việc | Kết quả |
|---|---|---|
| 1. Pose Tracking | Webcam, MediaPipe, landmarks | Theo dõi toàn thân |
| 2. Motion Recognition | Đấm, đá, né, đỡ, nhảy, di chuyển | Nhận diện động tác |
| 3. Game Foundation | Arena, nhân vật, animation, camera | Game 2D cơ bản |
| 4. Player Controller | Kết nối chuyển động với game | Điều khiển bằng cơ thể |
| 5. Combat System | HP, stamina, hitbox, damage | Có thể chiến đấu |
| 6. NPC AI | Tấn công, phòng thủ, né, phản công | Đấu được với máy |
| 7. Polish | UI, âm thanh, hiệu ứng, calibration | MVP hoàn chỉnh |

### 9.1. Phạm vi MVP đề xuất

- Một người chơi.
- Một đối thủ AI.
- Một đấu trường 2D.
- Khoảng 6–8 nhóm hành động cơ bản.
- Hệ thống HP và Stamina.
- Combo cơ bản.
- Ba cấp độ khó ban đầu: Easy, Normal, Hard.
- Webcam tracking toàn thân.
- Menu và màn hình Calibration.
- Quick Fight và Training Mode.

### 9.2. Tiêu chí nghiệm thu

- Nhận diện được các động tác trong điều kiện camera phù hợp.
- Điều khiển nhân vật bằng webcam, không cần bàn phím trong trận đấu.
- NPC có thể chiến đấu và phản ứng với người chơi.
- Không liên tục kích hoạt nhầm hoặc lặp động tác.
- Game duy trì tốc độ khung hình ổn định trên cấu hình mục tiêu.
- Người chơi có thể hoàn thành một trận đấu từ đầu đến cuối.
- Có hướng dẫn khi tracking thất bại hoặc người chơi ra khỏi vùng camera.

---

## 10. Thách thức kỹ thuật và hướng xử lý

| Thách thức | Hướng xử lý |
|---|---|
| Nhận diện nhầm động tác | Kết hợp góc khớp, vận tốc và chuỗi chuyển động |
| Độ trễ khi điều khiển | Tối ưu MediaPipe, giảm độ phân giải webcam, xử lý bất đồng bộ |
| Người chơi có vóc dáng khác nhau | Calibration cá nhân và chuẩn hóa tọa độ |
| Camera không nhìn thấy chân | Hướng dẫn khoảng cách, góc đặt và vùng camera |
| Một hành động bị kích hoạt nhiều lần | Cooldown, Action State và event debouncing |
| Game bị giật | Tách tiến trình tracking và game |
| NPC quá dễ hoặc quá khó | Điều chỉnh AI theo cấp độ và thống kê hành vi |
| Mất tracking giữa trận | Tạm dừng phát lệnh, hiển thị cảnh báo và cho phép tracking lại |

### 10.1. Yêu cầu môi trường chơi an toàn

- Người chơi cần đứng đủ xa webcam để nhìn thấy toàn thân, đặc biệt là chân khi đá hoặc nhảy.
- Khu vực chơi cần đủ rộng và không có vật cản.
- Tránh yêu cầu các động tác quá mạnh hoặc có nguy cơ gây chấn thương.
- Có thể bổ sung chế độ giảm cường độ chuyển động hoặc thay thế một số động tác bằng cử chỉ nhẹ hơn.

---

## 11. Định hướng phát triển tương lai

Sau khi hoàn thành MVP, có thể mở rộng các tính năng sau:

### 11.1. Advanced Motion Recognition

Nhận diện các thế võ, động tác phức tạp và chuỗi combo dài hơn. Có thể nghiên cứu mô hình phân loại chuỗi chuyển động khi rule-based không còn đáp ứng đủ.

### 11.2. Personalized / Adaptive AI

NPC thích nghi với phong cách chiến đấu của từng người chơi, dựa trên thống kê hành vi và hiệu quả của các chiến thuật.

### 11.3. Training Analytics

Thống kê số cú đấm, cú đá, combo, tỷ lệ nhận diện và độ chính xác của các động tác. Có thể đưa ra gợi ý cải thiện kỹ thuật.

### 11.4. Fitness Mode

Biến game thành một hình thức vận động, thiết kế các bài tập theo thời lượng, cường độ và nhóm động tác.

### 11.5. Mở rộng nội dung

- Thêm nhân vật và võ phái.
- Thêm đấu trường.
- Thêm boss và Story Campaign.
- Thêm hệ thống kỹ năng và trang phục.
- Phát triển chế độ hai người chơi bằng hai webcam hoặc hệ thống tracking riêng.

---

## 12. Rủi ro và quyết định cần xác nhận

Một số nội dung nên được kiểm chứng trong quá trình làm prototype trước khi mở rộng:

1. **Độ chính xác nhận diện:** MediaPipe Pose có nhận diện ổn định các cú đấm, đá và né trong điều kiện webcam thực tế hay không?
2. **Độ trễ:** Tổng thời gian từ chuyển động thật đến phản hồi trên game có đủ thấp để tạo cảm giác điều khiển trực tiếp hay không?
3. **Di chuyển trong game:** Nên dùng bước chân thật, dịch chuyển trọng tâm hay kết hợp cả hai để điều khiển trái/phải?
4. **Animation:** Nguồn sprite và animation nào phù hợp với phong cách đồ họa và phạm vi MVP?
5. **Cấu hình mục tiêu:** Cần xác định độ phân giải webcam, FPS và cấu hình máy tối thiểu.

Nên thực hiện một prototype tracking và combat nhỏ để đo các yếu tố này trước khi đầu tư vào nhiều nhân vật hoặc nội dung game.

---

## 13. Kết luận

BODY FIGHTER là dự án kết hợp giữa game 2D, Computer Vision và AI, với trải nghiệm điều khiển nhân vật thông qua chuyển động cơ thể thực tế.

Ba trụ cột chính của sản phẩm:

1. **Natural Control:** Điều khiển tự nhiên, phản hồi nhanh và chính xác bằng chuyển động toàn thân.
2. **Responsive Combat:** Các đòn đánh, né tránh và phòng thủ có cảm giác rõ ràng, phản hồi tốt.
3. **Intelligent Opponent:** Đối thủ AI đủ thông minh để tạo thử thách và khiến các trận đấu có sự đa dạng.

### Thứ tự bắt đầu được khuyến nghị

1. **Motion Demo:** Xây dựng ứng dụng Python nhận diện người và 6–8 động tác; hiển thị skeleton và tên hành động.
2. **Game Demo:** Tạo game 2D với một người chơi và một NPC; ban đầu có thể dùng bàn phím để kiểm thử combat.
3. **Full Integration:** Kết nối Python và Godot để điều khiển nhân vật hoàn toàn bằng webcam.
4. **AI Combat:** Hoàn thiện hành vi NPC, combo, hiệu ứng, giao diện và các cấp độ khó.

**Định hướng kiến trúc cuối cùng:** Godot làm game engine, Python + MediaPipe làm motion recognition service, giao tiếp qua WebSocket hoặc TCP local. Đây là hướng triển khai gọn, dễ kiểm thử và phù hợp với một dự án cá nhân.
