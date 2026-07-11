# Spring Boot 订单服务：从请求到事务提交

> 这是一篇用于测试 CodeWise Markdown 渲染能力的 Spring 技术帖。
> 内容覆盖公式、代码高亮、表格、任务列表、引用、链接、图片和常见 GFM 语法。

![Spring](https://img.shields.io/badge/Spring_Boot-3.4-6DB33F?logo=springboot&logoColor=white)

## 1. 项目背景

假设我们正在实现一个订单接口：用户提交商品编号和数量，系统扣减库存并创建订单。

- 使用 **Spring Boot 3** 构建 HTTP 服务
- 使用 `@Transactional` 保证数据一致性
- 使用 ~~字段注入~~ 构造器注入管理依赖
- 使用 MySQL 保存订单和库存

相关资料：[Spring Boot 官方文档](https://docs.spring.io/spring-boot/index.html)

---

## 2. 请求链路

1. `OrderController` 接收请求
2. `OrderService` 校验库存
3. `InventoryRepository` 扣减库存
4. `OrderRepository` 创建订单
5. 事务提交后返回订单编号

### Controller

```java
package com.codewise.order.controller;

import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/orders")
public class OrderController {
    private final OrderService orderService;

    public OrderController(OrderService orderService) {
        this.orderService = orderService;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public OrderResult create(@Valid @RequestBody CreateOrderRequest request) {
        return orderService.createOrder(request);
    }
}
```

### Service 与事务

```java
@Service
public class OrderService {
    private final InventoryRepository inventoryRepository;
    private final OrderRepository orderRepository;

    public OrderService(
            InventoryRepository inventoryRepository,
            OrderRepository orderRepository) {
        this.inventoryRepository = inventoryRepository;
        this.orderRepository = orderRepository;
    }

    @Transactional
    public OrderResult createOrder(CreateOrderRequest request) {
        int affected = inventoryRepository.deduct(
            request.productId(), request.quantity()
        );

        if (affected == 0) {
            throw new IllegalStateException("库存不足");
        }

        Order order = orderRepository.save(
            new Order(request.productId(), request.quantity())
        );
        return new OrderResult(order.getId(), "CREATED");
    }
}
```

## 3. 条件更新 SQL

```sql
UPDATE inventory
SET stock = stock - :quantity,
    update_time = CURRENT_TIMESTAMP
WHERE product_id = :productId
  AND stock >= :quantity;
```

返回行数为 `0` 时表示库存不足。相比“先查询再更新”，条件更新能减少并发超卖窗口。

| 方案 | SQL 次数 | 并发安全 | 使用场景 |
| --- | ---: | :---: | --- |
| 先查询后更新 | 2 | 否 | 低并发原型 |
| 条件更新 | 1 | 是 | 一般订单系统 |
| Redis + Lua | 1 | 是 | 高并发秒杀 |

## 4. 简单的性能估算

若单实例平均每秒处理 $\lambda = 250$ 个请求，平均响应时间为 $W = 0.08s$，根据 Little's Law：

$$
L = \lambda W = 250 \times 0.08 = 20
$$

系统中平均约有 **20 个正在处理的请求**。

连接池大小可以粗略估算为：

$$
N_{pool} \approx T_{n} \times \frac{T_{db}}{T_{total}} \times U
$$

其中 $T_n$ 是工作线程数，$U$ 是目标数据库连接利用率。这个公式只用于初始估算，最终仍应以压测结果为准。

## 5. 配置示例

```yaml
spring:
  datasource:
    url: jdbc:mysql://localhost:3306/codewise
    username: ${DB_USERNAME:root}
    password: ${DB_PASSWORD:root}
    hikari:
      maximum-pool-size: 20
      minimum-idle: 5
  jpa:
    open-in-view: false
```

```json
{
  "productId": 1001,
  "quantity": 2,
  "requestId": "order-test-001"
}
```

```bash
curl -X POST http://localhost:8082/api/orders \
  -H "Content-Type: application/json" \
  -d '{"productId":1001,"quantity":2}'
```

## 6. 测试清单

- [x] 正常创建订单
- [x] 库存不足时回滚事务
- [ ] 重复 `requestId` 的幂等校验
- [ ] 数据库超时时的异常映射
- [ ] 并发扣减库存压测

嵌套检查项：

- API 层
  - 参数校验
  - HTTP 状态码
- Service 层
  - 事务边界
  - 业务异常

## 7. 注意事项

> **事务提醒：** 同一个类内部直接调用另一个 `@Transactional` 方法，可能绕过 Spring AOP 代理，导致事务注解不生效。

行内代码示例：`Propagation.REQUIRES_NEW`、`Isolation.READ_COMMITTED`。

特殊字符测试：`<T>`、`a && b`、`Map<String, List<Long>>`。

---

### 总结

订单创建的核心不是 Controller 写得多漂亮，而是明确事务边界、并发策略和失败语义。先保证正确，再用指标和压测决定是否引入 Redis、消息队列或分布式事务。

