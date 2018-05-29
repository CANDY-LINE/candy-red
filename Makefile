prepublish:
	DEVEL=true npm install && \
	npm run freeze && \
	DEVEL=true npm install && \
	git checkout HEAD -- npm-shrinkwrap.json
