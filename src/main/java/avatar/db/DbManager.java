/*
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */
package avatar.db;

import com.zaxxer.hikari.HikariConfig;
import com.zaxxer.hikari.HikariDataSource;

import java.io.FileInputStream;
import java.io.IOException;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.SQLException;
import java.util.Properties;

import org.apache.commons.dbutils.QueryRunner;
import org.apache.log4j.Logger;

public class DbManager {

    private static final Logger logger = Logger.getLogger(DbManager.class);

    private static DbManager instance = null;
    private HikariDataSource hikariDataSource;
    private String host;
    private int port;
    private String dbname;
    private String username;
    private String passeword;
    private String driver;
    private int maxConnections;
    private int minConnections;

    public static DbManager getInstance() {
        if (instance == null) {
            instance = new DbManager();
        }
        return instance;
    }

    private DbManager() {
        try {
            FileInputStream input = new FileInputStream("database.properties");
            Properties props = new Properties();
            props.load(new InputStreamReader(input, StandardCharsets.UTF_8));
            this.driver = props.getProperty("driver");
            logger.debug("DB Driver: " + this.driver);
            this.host = props.getProperty("host");
            logger.debug("DB Host: " + this.host);
            this.port = Integer.parseInt(props.getProperty("port"));
            logger.debug("DB Port: " + this.port);
            this.dbname = props.getProperty("dbname");
            logger.debug("DB Name: " + this.dbname);
            this.username = props.getProperty("username");
            logger.debug("DB Username: " + this.username);
            this.passeword = props.getProperty("password");
            logger.debug("DB Password: " + this.passeword);
            this.maxConnections = Integer.parseInt(props.getProperty("max_connection"));
            logger.debug("DB Max Connections: " + this.maxConnections);
            this.minConnections = Integer.parseInt(props.getProperty("min_connection"));
            logger.debug("DB Min Connections: " + this.minConnections);
        } catch (IOException ex) {
            logger.error("init ", ex);
        }

    }

    public void start() {
        if (this.hikariDataSource != null) {
            logger.warn("DB Connection Pool has already been created.");
        } else {
            try {
                HikariConfig config = new HikariConfig();
                config.setJdbcUrl("jdbc:mysql://" + this.host + ":" + this.port + "/" + this.dbname);
                config.setDriverClassName(this.driver);
                config.setUsername(this.username);
                config.setPassword(this.passeword);
                config.setMinimumIdle(this.minConnections);
                config.setMaximumPoolSize(this.maxConnections);
                config.addDataSourceProperty("cachePrepStmts", "true");
                config.addDataSourceProperty("prepStmtCacheSize", "250");
                config.addDataSourceProperty("prepStmtCacheSqlLimit", "2048");

                this.hikariDataSource = new HikariDataSource(config);
                logger.debug("DB Connection Pool has created.");

            } catch (Exception e) {
                logger.error("DB Connection Pool Creation has failed.", e);
            }
        }
    }

    public void shutdown() {
        try {
            if (this.hikariDataSource != null) {
                this.hikariDataSource.close();
                logger.debug("DB Connection Pool is shutting down.");
            }
            this.hikariDataSource = null;
        } catch (Exception e) {
            logger.warn("Error when shutting down DB Connection Pool");
        }
    }

    public Connection getConnection() throws SQLException {
        return this.hikariDataSource.getConnection();
    }

    public int executeUpdate(String sqlStatement, Object... params) {
        try (Connection connection = getConnection();
             PreparedStatement preparedStatement = connection.prepareStatement(sqlStatement)) {
            int i = 1;
            for (Object object : params) {
                preparedStatement.setObject(i++, object);
            }
            return preparedStatement.executeUpdate();
        } catch (Exception ex) {
            ex.printStackTrace();
        }
        return 0;
    }
}
