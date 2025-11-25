# 1. Cài môi trường

- Cài đặt JDK: [Đảm bảo bạn đã cài đặt Java Development Kit (JDK) phiên bản 8.](https://www.oracle.com/java/technologies/javase/jdk18-archive-downloads.html)
- Cài đặt Maven: [Đảm bảo Maven đã được cài đặt và cấu hình đúng cách trên hệ thống của bạn.](https://maven.apache.org/download.cgi)

# 2. Cấu hình môi trường

- **JAVA_HOME**: Thêm JAVA_HOME trỏ đến thư mục cài đặt JDK của bạn (ví dụ: C:\Program Files\Java\jdk1.8.0_202 ).
- **M2_HOME** (hoặc MAVEN_HOME): Thêm M2_HOME (hoặc MAVEN_HOME ) trỏ đến thư mục Maven đã giải nén (ví dụ: C:\Program Files\Apache\maven\apache-maven-3.9.6 ).
- **Path**: Thêm %M2_HOME%\bin (hoặc %MAVEN_HOME%\bin ) vào cuối danh sách biến môi trường Path.

# 3. Startup (khởi động server)

> $ mvn clean install

> $ cd docker_compose

> $ docker-compose up -d

```
Lưu ý: chạy 'docker-compose up -d' game-server lỗi! 😒😒. Đừng lo lắng, hãy chạy lại 'docker-compose up -d' phát nữa.
```



