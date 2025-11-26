# Sử dụng hình ảnh OpenJDK 8 làm cơ sở
FROM eclipse-temurin:8-jdk-alpine

# Đặt thư mục làm việc bên trong container
WORKDIR /app

# Sao chép tệp JAR đã xây dựng vào container
COPY target/Avatar2D-1.0-SNAPSHOT.jar /app/server.jar

# Sao chép các tệp cấu hình
COPY config.properties /app/config.properties
COPY database.properties /app/database.properties

# Mở cổng mà máy chủ game sử dụng (ví dụ: 12345, bạn có thể cần điều chỉnh cổng này)
EXPOSE 19128

# Lệnh để chạy ứng dụng máy chủ game
CMD ["java", "-jar", "server.jar"]