FROM nginx:alpine

# Remove o HTML padrão de boas-vindas do Nginx
RUN rm -rf /usr/share/nginx/html/*

# Copia todos os arquivos do seu projeto para o diretório web do Nginx
COPY . /usr/share/nginx/html

# Altera a porta padrão de 80 para 8080 (exigência do Cloud Run)
RUN sed -i 's/listen  *80;/listen 8080;/g' /etc/nginx/conf.d/default.conf

EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]
