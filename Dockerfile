FROM maven:3.8.5-openjdk-17 AS build
WORKDIR /app
COPY pom.xml .
COPY src ./src
RUN mvn clean package -DskipTests

FROM eclipse-temurin:8-jdk-alpine

WORKDIR /app

COPY --from=build /app/target/Avatar2D-1.0-SNAPSHOT.jar /app/server.jar

# File cấu hình
COPY config.properties /app/config.properties
COPY database.properties /app/database.properties

EXPOSE 19128

CMD ["java", "-jar", "server.jar"]