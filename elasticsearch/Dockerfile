FROM elasticsearch:8.17.0

# 自动安装 ik 中文分词器插件
RUN ./bin/elasticsearch-plugin install --batch https://github.com/medcl/elasticsearch-analysis-ik/releases/download/v8.17.0/elasticsearch-analysis-ik-8.17.0.zip
